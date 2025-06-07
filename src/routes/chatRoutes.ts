// src/routes/chatRoutes.ts
import express, { Request, Response, NextFunction, RequestHandler } from 'express'; // Import Request, Response, NextFunction, RequestHandler
import { authenticateToken } from '../middleware/auth';
import Chat from '../models/Chat';
import User from '../models/User';
import Message from '../models/Message';
import asyncHandler from '../utils/asyncHandler';

const router = express.Router();

// Get all chats for the authenticated user
router.get('/user', authenticateToken, asyncHandler(async (req, res): Promise<void> => { // <--- Explicitly type the handler's return
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
router.post('/', authenticateToken, asyncHandler(async (req, res): Promise<void> => { // <--- Explicitly type the handler's return
    const { targetUserId } = req.body;

    if (!targetUserId) {
        res.status(400).json({ msg: 'Target user ID is required.' });
        return; // Explicitly return void
    }

    if (req.userId === targetUserId) {
        res.status(400).json({ msg: 'Cannot create a chat with yourself.' });
        return; // Explicitly return void
    }

    try {
        let chat = await Chat.findOne({
            isGroup: false,
            members: {
                $all: [req.userId, targetUserId],
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
            return; // Explicitly return void
        }

        const newChat = await Chat.create({
            members: [req.userId, targetUserId],
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

        console.log('[CHAT_ROUTE] New chat created:', createdChat?._id);
        res.status(201).json(createdChat);

    } catch (error) {
        console.error('Error creating or getting chat:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
}));

// Get a specific chat by its ID
router.get('/:chatId', authenticateToken, asyncHandler(async (req, res): Promise<void> => { // <--- Explicitly type the handler's return
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
            return; // Explicitly return void
        }

        if (!chat.members.some(member => member._id.toString() === req.userId)) {
            res.status(403).json({ msg: 'Unauthorized: You are not a member of this chat.' });
            return; // Explicitly return void
        }

        res.status(200).json(chat);
    } catch (error) {
        console.error('Error fetching chat by ID:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
}));

export default router;