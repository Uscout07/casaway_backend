// src/routes/chatRoutes.ts
import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth';
import Chat from '../models/Chat';
import User from '../models/User';
import Message from '../models/Message';
import asyncHandler from '../utils/asyncHandler';
import Notification from '../models/Notifications'; // Import Notification model
import mongoose from 'mongoose'; // Import mongoose to access ObjectId type

const router = express.Router();

// Extend Request to include userId from authenticateToken middleware
declare module 'express-serve-static-core' {
    interface Request {
        userId?: string;
    }
}

// Get all chats for the authenticated user
router.get('/user', authenticateToken, asyncHandler(async (req, res): Promise<void> => {
    try {
        console.log(`[chatRoutes] Fetching chats for userId: ${req.userId}`);

        const chats = await Chat.find({ members: req.userId })
            .populate('members', 'name email profilePic')
            .populate({
                path: 'lastMessage',
                model: 'Message',
                populate: {
                    path: 'sender',
                    model: 'User',
                    select: 'name profilePic'
                }
            })
            .sort({ updatedAt: -1 });

        console.log(`[chatRoutes] Successfully fetched ${chats.length} chats.`);
        if (chats.length > 0) {
            console.log('First chat (populated) sent to frontend:', JSON.stringify(chats[0], null, 2));
        }

        res.json(chats);

    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).json({ msg: 'Internal Server Error' });
    }
}));

// Create or get a one-on-one chat
router.post('/', authenticateToken, asyncHandler(async (req, res): Promise<void> => {
    const { targetUserId } = req.body;
    const currentUserId = req.userId;

    if (!targetUserId) {
        res.status(400).json({ msg: 'Target user ID is required.' });
        return;
    }

    if (currentUserId === targetUserId) {
        res.status(400).json({ msg: 'Cannot create a chat with yourself.' });
        return;
    }

    try {
        let chat = await Chat.findOne({
            isGroup: false,
            members: {
                $all: [currentUserId, targetUserId],
                $size: 2
            }
        })
            .populate('members', 'name email profilePic');

        if (chat) {
            chat = await chat.populate({
                path: 'lastMessage',
                model: 'Message',
                populate: {
                    path: 'sender',
                    model: 'User',
                    select: 'name profilePic'
                }
            });
            console.log('[CHAT_ROUTE] Existing chat found:', chat._id);
            res.status(200).json(chat);
            return;
        }

        const newChat = await Chat.create({
            members: [currentUserId, targetUserId],
            isGroup: false,
            lastMessage: null,
            messages: []
        });

        const createdChat = await Chat.findById(newChat._id)
            .populate('members', 'name email profilePic')
            .populate({
                path: 'lastMessage',
                model: 'Message',
                populate: {
                    path: 'sender',
                    model: 'User',
                    select: 'name profilePic'
                }
            });

        // Create notification for the target user that a new chat has been initiated
        if (currentUserId && targetUserId) {
            await Notification.create({
                recipient: new mongoose.Types.ObjectId(targetUserId), // Convert to ObjectId
                type: 'chat',
                sourceUser: new mongoose.Types.ObjectId(currentUserId), // Convert to ObjectId
                relatedId: newChat._id,
                targetType: 'chat'
            });
        }

        console.log('[CHAT_ROUTE] New chat created:', createdChat?._id);
        res.status(201).json(createdChat);

    } catch (error) {
        console.error('Error creating or getting chat:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
}));

// Get a specific chat by its ID
router.get('/:chatId', authenticateToken, asyncHandler(async (req, res): Promise<void> => {
    try {
        const { chatId } = req.params;

        const chat = await Chat.findById(chatId)
            .populate('members', 'name email profilePic')
            .populate({
                path: 'lastMessage',
                model: 'Message',
                populate: {
                    path: 'sender',
                    model: 'User',
                    select: 'name profilePic'
                }
            });

        if (!chat) {
            res.status(404).json({ msg: 'Chat not found.' });
            return;
        }

        if (!chat.members.some(member => member._id.toString() === req.userId)) {
            res.status(403).json({ msg: 'Unauthorized: You are not a member of this chat.' });
            return;
        }

        res.status(200).json(chat);
    } catch (error) {
        console.error('Error fetching chat by ID:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
}));

export default router;