// notificationRoutes.ts
import express, { Request, Response } from 'express';
import Notification from '../models/Notifications'; // Adjust path as needed
import { authenticateToken } from '../middleware/auth'; // Assuming auth middleware is here
import asyncHandler from '../utils/asyncHandler'; // Assuming asyncHandler is here
import Comment from '../models/Comment'; // Import Comment model to get parent post/listing
import Post from '../models/Post'; // Import Post model
import Listing from '../models/Listing'; // Import Listing model
import mongoose from 'mongoose'; // Import mongoose for ObjectId

const router = express.Router();

// Extend Request to include userId from authenticateToken middleware
declare module 'express-serve-static-core' {
    interface Request {
        userId?: string;
    }
}

// GET all notifications for the authenticated user
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    try {
        if (!req.userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        const notifications = await Notification.find({ recipient: req.userId })
            .populate('sourceUser', 'name profilePic') // Populate sourceUser for display
            .sort({ createdAt: -1 })
            .lean(); // Use .lean() for plain JavaScript objects

        // Post-process notifications to add parent entity ID for comments/replies
        const populatedNotifications = await Promise.all(notifications.map(async (notif) => {
            if (notif.targetType === 'comment' || notif.targetType === 'reply') {
                const comment = await Comment.findById(notif.relatedId).select('post listing');
                if (comment) {
                    return {
                        ...notif,
                        parentEntityId: comment.post ? comment.post.toString() : (comment.listing ? comment.listing.toString() : undefined),
                        parentEntityType: comment.post ? 'post' : (comment.listing ? 'listing' : undefined)
                    };
                }
            }
            return notif; // Return original notification if no special handling needed
        }));

        res.json(populatedNotifications);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ message: 'Error fetching notifications' });
    }
}));

// DELETE a specific notification by ID (frontend delete button)
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid notification ID' });
            return;
        }

        const notification = await Notification.findById(id);

        if (!notification) {
            res.status(404).json({ message: 'Notification not found' });
            return;
        }

        // Ensure the user is authorized to delete this notification (they are the recipient)
        if (notification.recipient.toString() !== userId) {
            res.status(403).json({ message: 'Unauthorized to delete this notification' });
            return;
        }

        await Notification.deleteOne({ _id: id });
        res.status(200).json({ message: 'Notification deleted successfully' });
    } catch (err) {
        console.error('Error deleting notification:', err);
        res.status(500).json({ message: 'Error deleting notification' });
    }
}));

// DELETE notifications older than 8 weeks (for backend cleanup)
router.delete('/cleanup', asyncHandler(async (req: Request, res: Response) => {
    try {
        const eightWeeksAgo = new Date();
        eightWeeksAgo.setDate(eightWeeksAgo.getDate() - (8 * 7)); // 8 weeks * 7 days/week

        const result = await Notification.deleteMany({
            createdAt: { $lt: eightWeeksAgo }
        });

        res.status(200).json({
            message: `Deleted ${result.deletedCount} notifications older than 8 weeks.`,
            deletedCount: result.deletedCount
        });
    } catch (err) {
        console.error('Error during notification cleanup:', err);
        res.status(500).json({ message: 'Error during notification cleanup' });
    }
}));

export default router;
