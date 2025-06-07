// src/routes/chatRoutes.ts
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import Chat from '../models/Chat';
import User from '../models/User'; // Import User to populate members' details
import Message from '../models/Message'; // Ensure Message is imported

const router = express.Router();

// Get all chats for the authenticated user
router.get('/user', authenticateToken, async (req, res) => {
    try {
        console.log(`[chatRoutes] Fetching chats for userId: ${req.userId}`); // Debugging line

        const chats = await Chat.find({ members: req.userId })
            .populate('members', 'name email profilePic') // 1. Populate chat members
            .populate({
                path: 'lastMessage', // 2. Populate the lastMessage field
                model: 'Message',    // Explicitly define the model if not inferring
                populate: {
                    path: 'sender',  // 3. And inside lastMessage, populate the sender field
                    model: 'User',   // Explicitly define the model if not inferring
                    select: 'name profilePic' // 4. Select name and profilePic for sender
                }
            })
            .sort({ updatedAt: -1 });

        console.log(`[chatRoutes] Successfully fetched ${chats.length} chats.`); // Debugging line
        // Optional: Log the *actual populated data* before sending to frontend
        if (chats.length > 0) {
            console.log('First chat (populated) sent to frontend:', JSON.stringify(chats[0], null, 2));
        }

        // Send the response ONLY ONCE
        res.json(chats);

    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).json({ msg: 'Internal Server Error' });
    }
});

// Create or get a one-on-one chat
router.post('/', authenticateToken, async (req, res) => {
    const { targetUserId } = req.body; // The ID of the user we want to chat with

    if (!targetUserId) {
        return res.status(400).json({ msg: 'Target user ID is required.' });
    }

    // Prevent creating a chat with yourself
    if (req.userId === targetUserId) {
        return res.status(400).json({ msg: 'Cannot create a chat with yourself.' });
    }

    try {
        // 1. Check if a chat already exists between these two users
        let chat = await Chat.findOne({
            isGroup: false, // Ensure it's a direct message
            members: {
                $all: [req.userId, targetUserId], // Both must be members
                $size: 2 // Exactly two members
            }
        })
        .populate('members', 'name email profilePic'); // Populate members for response

        // If you want the lastMessage to also be populated on existing chats, add it here too:
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
            return res.status(200).json(chat);
        }

        // 2. If no chat exists, create a new one
        const newChat = await Chat.create({
            members: [req.userId, targetUserId],
            isGroup: false,
            lastMessage: null, // No messages yet
            messages: []
        });

        // Populate members and lastMessage (which will be null) for the newly created chat before sending response
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
});

// Get a specific chat by its ID
router.get('/:chatId', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;

        // Find the chat by ID and populate members and lastMessage
        const chat = await Chat.findById(chatId)
            .populate('members', 'name email profilePic') // Populate member details
            .populate({
                path: 'lastMessage', // Also populate lastMessage if you need it for the single chat view
                model: 'Message',
                populate: {
                    path: 'sender',
                    model: 'User',
                    select: 'name profilePic'
                }
            });

        if (!chat) {
            return res.status(404).json({ msg: 'Chat not found.' });
        }

        // Optional: Ensure the authenticated user is a member of this chat
        if (!chat.members.some(member => member._id.toString() === req.userId)) {
            return res.status(403).json({ msg: 'Unauthorized: You are not a member of this chat.' });
        }

        res.status(200).json(chat);
    } catch (error) {
        console.error('Error fetching chat by ID:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
});

export default router;