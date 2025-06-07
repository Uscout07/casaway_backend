// src/routes/messageRoutes.ts
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import Message from '../models/Message';
import Chat from '../models/Chat'; // Import Chat model to update lastMessage

const router = express.Router();

// GET messages for a specific chat
router.get('/:chatId', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const messages = await Message.find({ chat: chatId })
            .populate('sender', 'name profilePic') // Populate sender's name and profilePic
            .sort({ createdAt: 1 }); // Sort by creation date ascending

        res.status(200).json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
});

// NEW ENDPOINT: POST a new message to a chat
router.post('/', authenticateToken, async (req, res) => {
    const { chatId, content } = req.body; // Expect chatId and content from the request body
    const senderId = req.userId; // Get sender ID from the authenticated token

    if (!chatId || !content) {
        return res.status(400).json({ msg: 'Chat ID and content are required.' });
    }

    try {
        // 1. Find the chat to ensure it exists and the sender is a member
        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ msg: 'Chat not found.' });
        }

        // Security check: Ensure the sender is actually a member of this chat
        if (!chat.members.some(member => member.toString() === senderId)) {
            return res.status(403).json({ msg: 'Unauthorized: You are not a member of this chat.' });
        }

        // 2. Create the new message
        const newMessage = await Message.create({
            chat: chatId,
            sender: senderId,
            content: content,
            readBy: [senderId] // Sender has read their own message
        });

        // 3. Update the chat's lastMessage field
        chat.lastMessage = newMessage._id;
        await chat.save();

        // 4. Populate the sender information for the response (important for frontend UI)
        const populatedMessage = await Message.findById(newMessage._id)
                                            .populate('sender', 'name profilePic');

        // Optional: Emit message via Socket.IO if you set it up
        // req.app.get('io').to(chatId).emit('messageReceived', populatedMessage);

        res.status(201).json(populatedMessage); // Return the newly created message with sender populated

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
});

export default router;