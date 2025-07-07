// src/models/Message.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
    chat: mongoose.Types.ObjectId;
    sender: mongoose.Types.ObjectId;
    content: string;
    readBy: mongoose.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
    hiddenBy: mongoose.Types.ObjectId[];
}

const messageSchema = new Schema<IMessage>(
    {
        chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        content: { type: String, trim: true, required: true },
        readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        hiddenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    { timestamps: true }
);

const Message = mongoose.model<IMessage>('Message', messageSchema);

export default Message;