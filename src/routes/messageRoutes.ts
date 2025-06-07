// src/routes/messageRoutes.ts
import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import Message from '../models/Message';
import Chat from '../models/Chat';
import asyncHandler from '../utils/asyncHandler';
import mongoose from 'mongoose'; // Import mongoose to access ObjectId type

const router = express.Router();

// Extend Request to include userId from authenticateToken middleware
declare module 'express-serve-static-core' {
    interface Request {
        userId?: string;
    }
}

// Helper for error messages (optional, but good practice if not using a centralized error handler)
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as { message: unknown }).message);
    }
    return String(error);
}

// GET messages for a specific chat
router.get('/:chatId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { chatId } = req.params;
    const messages = await Message.find({ chat: chatId })
        .populate('sender', 'name profilePic')
        .sort({ createdAt: 1 });

    res.status(200).json(messages);
}));

// NEW ENDPOINT: POST a new message to a chat
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { chatId, content } = req.body;
    const senderId = req.userId;

    if (!senderId) {
        res.status(401).json({ msg: 'User not authenticated.' });
        return;
    }

    if (!chatId || !content) {
        res.status(400).json({ msg: 'Chat ID and content are required.' });
        return;
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
        res.status(404).json({ msg: 'Chat not found.' });
        return;
    }

    if (!chat.members.some(member => member.toString() === senderId)) {
        res.status(403).json({ msg: 'Unauthorized: You are not a member of this chat.' });
        return;
    }

    const newMessage = await Message.create({
        chat: chatId,
        sender: senderId,
        content: content,
        readBy: [senderId]
    });

    // Fix for TS2322: Explicitly cast newMessage._id to mongoose.Types.ObjectId
    chat.lastMessage = newMessage._id as mongoose.Types.ObjectId;
    await chat.save();

    const populatedMessage = await Message.findById(newMessage._id)
                                        .populate('sender', 'name profilePic');

    res.status(201).json(populatedMessage);
}));

export default router;