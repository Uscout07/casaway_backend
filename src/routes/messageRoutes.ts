// src/routes/messageRoutes.ts
import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import Message from '../models/Message';
import Chat from '../models/Chat';
import asyncHandler from '../utils/asyncHandler';
import mongoose from 'mongoose';
import Notification from '../models/Notifications'; // Import Notification model

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

    const messages = await Message.find({
        chat: chatId,
        hiddenBy: { $ne: req.userId }
    })
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

    chat.lastMessage = newMessage._id as mongoose.Types.ObjectId;
    await chat.save();

    const populatedMessage = await Message.findById(newMessage._id)
        .populate('sender', 'name profilePic');

    // Create notifications for other chat members
    chat.members.forEach(async (memberId) => {
        if (memberId.toString() !== senderId.toString()) {
            await Notification.create({
                recipient: memberId,
                type: 'message',
                sourceUser: senderId,
                relatedId: chat._id,
                targetType: 'chat'
            });
        }
    });

    res.status(201).json(populatedMessage);
}));

// DELETE message for current user only (soft delete)
router.delete('/delete-for-me/:messageId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
        res.status(404).json({ msg: 'Message not found.' });
        return
    }

    const updatedHiddenBy = new Set([...(message.hiddenBy || []), userId]);
    message.hiddenBy = Array.from(updatedHiddenBy)
        .filter((id): id is string | mongoose.Types.ObjectId => id !== undefined)
        .map(id => typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id);
    await message.save();

    res.status(200).json({ msg: 'Message hidden for user.' });
}));

// DELETE message for everyone (hard delete)
router.delete('/delete-for-everyone/:messageId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
        res.status(404).json({ msg: 'Message not found.' });
        return
    }

    const isSender = message.sender.toString() === userId;
    const within24Hours = Date.now() - new Date(message.createdAt).getTime() <= 24 * 60 * 60 * 1000;

    if (!isSender || !within24Hours) {
        res.status(403).json({ msg: 'You can only delete your own message within 24 hours.' });
        return
    }

    await message.deleteOne();
    res.status(200).json({ msg: 'Message permanently deleted.' });
}));

// PATCH message content (edit message)
router.patch('/edit/:messageId', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!content || typeof content !== 'string') {
        res.status(400).json({ msg: 'New content is required.' });
        return
    }

    const message = await Message.findById(messageId);
    if (!message) {
        res.status(404).json({ msg: 'Message not found.' });
        return
    }

    const isSender = message.sender.toString() === userId;
    const within24Hours = Date.now() - new Date(message.createdAt).getTime() <= 24 * 60 * 60 * 1000;

    if (!isSender || !within24Hours) {
        res.status(403).json({ msg: 'You can only edit your own message within 24 hours.' });
        return
    }

    message.content = content;
    await message.save();

    const updated = await Message.findById(message._id).populate('sender', 'name profilePic');
    res.status(200).json(updated);
}));

export default router;