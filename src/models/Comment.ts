// models/Comment.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';

interface IUser {
    _id: Types.ObjectId;
    name: string;
    username: string;
    profilePic?: string;
}

interface IComment extends Document {
    user: Types.ObjectId | IUser;
    listing?: Types.ObjectId; // Optional for listing comments
    post?: Types.ObjectId;    // Optional for post comments
    text: string;
    parentComment?: Types.ObjectId | IComment | null;
    likes: Types.ObjectId[];
    isReply: boolean;
    mentionedUsers: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
    // Virtuals
    replyCount?: number;
    // Transient field for nested replies
    replies?: IComment[];
}

interface ICommentMethods {
    isLikedBy(userId: Types.ObjectId | string): boolean;
}

interface CommentModel extends Model<IComment, {}, ICommentMethods> {
    getInstagramStyleComments(listingId: Types.ObjectId | string): Promise<IComment[]>;
    getInstagramStyleCommentsForPost(postId: Types.ObjectId | string): Promise<IComment[]>;
}

const CommentSchema = new Schema<IComment, CommentModel, ICommentMethods>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    listing: {
        type: Schema.Types.ObjectId,
        ref: 'Listing',
        required: false
    },
    post: {
        type: Schema.Types.ObjectId,
        ref: 'Post',
        required: false
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    parentComment: {
        type: Schema.Types.ObjectId,
        ref: 'Comment',
        default: null
    },
    likes: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    isReply: {
        type: Boolean,
        default: false
    },
    mentionedUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Validation: Ensure either listing or post is provided, but not both
CommentSchema.pre('validate', function(next) {
    if (!this.listing && !this.post) {
        return next(new Error('Comment must be associated with either a listing or a post'));
    }
    if (this.listing && this.post) {
        return next(new Error('Comment cannot be associated with both a listing and a post'));
    }
    next();
});

// Middleware to extract mentioned users from text before saving
CommentSchema.pre<IComment>('save', async function(next: mongoose.CallbackWithoutResultAndOptionalError) {
    if (this.isModified('text')) {
        const mentionRegex = /@(\w+)/g;
        const mentions = [...this.text.matchAll(mentionRegex)];

        if (mentions.length > 0) {
            const usernames = mentions.map(match => match[1]);
            try {
                const User = mongoose.model('User');
                const mentionedUsers = await User.find({
                    username: { $in: usernames }
                }).select('_id');

                this.mentionedUsers = mentionedUsers.map(user => user._id as Types.ObjectId);
            } catch (error) {
                console.error('Error finding mentioned users:', error);
            }
        }

        this.isReply = !!this.parentComment;
        this.updatedAt = new Date();
    }
    next();
});

// Indexes for efficient queries
CommentSchema.index({ listing: 1, createdAt: -1 });
CommentSchema.index({ post: 1, createdAt: -1 });
CommentSchema.index({ parentComment: 1, createdAt: 1 });
CommentSchema.index({ user: 1 });

// Virtual to get reply count
CommentSchema.virtual('replyCount', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'parentComment',
    count: true
});

// Method to check if user has liked the comment
CommentSchema.methods.isLikedBy = function(this: IComment, userId: Types.ObjectId | string): boolean {
    const userIdString = userId.toString();
    return this.likes.some(id => id.equals(userIdString));
};

// Static method for Instagram-style comments for listings
CommentSchema.statics.getInstagramStyleComments = async function(this: CommentModel, listingId: Types.ObjectId | string): Promise<IComment[]> {
    const allComments = await this.find({ listing: listingId })
        .populate<{ user: IUser }>('user', 'name username profilePic')
        .populate<{ mentionedUsers: IUser[] }>('mentionedUsers', 'name username')
        .sort({ createdAt: 1 })
        .lean<IComment[]>();

    return organizeCommentsInstagramStyle(allComments);
};

// Static method for Instagram-style comments for posts
CommentSchema.statics.getInstagramStyleCommentsForPost = async function(this: CommentModel, postId: Types.ObjectId | string): Promise<IComment[]> {
    const allComments = await this.find({ post: postId })
        .populate<{ user: IUser }>('user', 'name username profilePic')
        .populate<{ mentionedUsers: IUser[] }>('mentionedUsers', 'name username')
        .sort({ createdAt: 1 })
        .lean<IComment[]>();

    return organizeCommentsInstagramStyle(allComments);
};

// Helper function to organize comments in Instagram style
function organizeCommentsInstagramStyle(allComments: IComment[]): IComment[] {
    const commentMap = new Map<string, IComment>();
    const topLevelComments: IComment[] = [];

    // First pass: populate commentMap and initialize replies array
    allComments.forEach((comment: IComment) => {
        if (!comment.replies) {
            comment.replies = [];
        }
        // Explicitly cast comment._id to Types.ObjectId
        commentMap.set((comment._id as Types.ObjectId).toString(), comment);
    });

    // Second pass: Organize into a 2-level hierarchy (Instagram-style)
    allComments.forEach((comment: IComment) => {
        // Explicitly cast comment.parentComment to Types.ObjectId before toString()
        const parentId = comment.parentComment ? (comment.parentComment as Types.ObjectId).toString() : undefined;

        if (parentId && commentMap.has(parentId)) {
            let actualParent: IComment | undefined = commentMap.get(parentId);

            // If the direct parent is itself a reply, find its main parent
            if (actualParent && actualParent.parentComment) {
                // Explicitly cast actualParent.parentComment to Types.ObjectId
                const grandparentId = (actualParent.parentComment as Types.ObjectId).toString();
                if (commentMap.has(grandparentId)) {
                    actualParent = commentMap.get(grandparentId);
                }
            }

            // Add the current comment to the replies array of its resolved main parent
            if (actualParent) {
                // Explicitly cast comment._id to Types.ObjectId
                actualParent.replies!.push(commentMap.get((comment._id as Types.ObjectId).toString())!);
            }
        } else {
            // This is a top-level comment
            // Explicitly cast comment._id to Types.ObjectId
            topLevelComments.push(commentMap.get((comment._id as Types.ObjectId).toString())!);
        }
    });

    // Sort replies by creation date (oldest first)
    topLevelComments.forEach((comment: IComment) => {
        if (comment.replies && comment.replies.length > 0) {
            comment.replies.sort((a: IComment, b: IComment) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
        }
    });

    // Sort top-level comments (newest first)
    topLevelComments.sort((a: IComment, b: IComment) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return topLevelComments;
}

const Comment = mongoose.model<IComment, CommentModel>('Comment', CommentSchema);
export default Comment;