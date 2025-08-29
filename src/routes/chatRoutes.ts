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

// Helper function to check if user is admin of a group
const isGroupAdmin = async (chatId: string, userId: string): Promise<boolean> => {
    const chat = await Chat.findById(chatId);
    return chat?.admins.includes(new mongoose.Types.ObjectId(userId)) || false;
};

// Get all chats for the authenticated user
router.get('/user', authenticateToken, asyncHandler(async (req, res): Promise<void> => {
    try {
        console.log(`[chatRoutes] Fetching chats for userId: ${req.userId}`);

        const chats = await Chat.find({ members: req.userId })
            .populate('members', 'name email profilePic')
            .populate('admins', 'name email profilePic')
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

// Create a new group chat
router.post('/group', authenticateToken, asyncHandler(async (req, res): Promise<void> => {
    const { groupName, groupDescription, memberIds, groupImage } = req.body;
    const currentUserId = req.userId;

    if (!groupName) {
        res.status(400).json({ msg: 'Group name is required.' });
        return;
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 2) {
        res.status(400).json({ msg: 'At least 2 members are required for a group chat.' });
        return;
    }

    try {
        // Add current user to members if not already included
        const allMembers = memberIds.includes(currentUserId) ? memberIds : [currentUserId, ...memberIds];

        // Verify all users exist
        const users = await User.find({ _id: { $in: allMembers } });
        if (users.length !== allMembers.length) {
            res.status(400).json({ msg: 'One or more users not found.' });
            return;
        }

        const newGroup = await Chat.create({
            members: allMembers,
            admins: [currentUserId], // Creator is the first admin
            createdBy: currentUserId,
            isGroup: true,
            groupName,
            groupDescription,
            groupImage,
            lastMessage: null,
            messages: []
        });

        const createdGroup = await Chat.findById(newGroup._id)
            .populate('members', 'name email profilePic')
            .populate('admins', 'name email profilePic')
            .populate({
                path: 'lastMessage',
                model: 'Message',
                populate: {
                    path: 'sender',
                    model: 'User',
                    select: 'name profilePic'
                }
            });

        // Create notifications for all members
        for (const memberId of allMembers) {
            if (memberId !== currentUserId) {
                await Notification.create({
                    recipient: new mongoose.Types.ObjectId(memberId),
                    type: 'group_invite',
                    sourceUser: new mongoose.Types.ObjectId(currentUserId),
                    relatedId: newGroup._id,
                    targetType: 'chat'
                });
            }
        }

        console.log('[CHAT_ROUTE] New group created:', createdGroup?._id);
        res.status(201).json(createdGroup);

    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
}));

// Add members to a group (admin only)
router.post('/:chatId/add-members', authenticateToken, asyncHandler(async (req, res): Promise<void> => {
    const { chatId } = req.params;
    const { memberIds } = req.body;
    const currentUserId = req.userId;

    if (!memberIds || !Array.isArray(memberIds)) {
        res.status(400).json({ msg: 'Member IDs array is required.' });
        return;
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ msg: 'Chat not found.' });
            return;
        }

        if (!chat.isGroup) {
            res.status(400).json({ msg: 'This endpoint is only for group chats.' });
            return;
        }

        // Check if user is admin
        if (!await isGroupAdmin(chatId, currentUserId!)) {
            res.status(403).json({ msg: 'Only admins can add members.' });
            return;
        }

        // Verify all users exist
        const users = await User.find({ _id: { $in: memberIds } });
        if (users.length !== memberIds.length) {
            res.status(400).json({ msg: 'One or more users not found.' });
            return;
        }

        // Add new members (avoid duplicates)
        const newMembers = memberIds.filter((id: string) => !chat.members.includes(new mongoose.Types.ObjectId(id)));
        chat.members.push(...newMembers.map((id: string) => new mongoose.Types.ObjectId(id)));
        await chat.save();

        const updatedChat = await Chat.findById(chatId)
            .populate('members', 'name email profilePic')
            .populate('admins', 'name email profilePic')
            .populate({
                path: 'lastMessage',
                model: 'Message',
                populate: {
                    path: 'sender',
                    model: 'User',
                    select: 'name profilePic'
                }
            });

        // Create notifications for new members
        for (const memberId of newMembers) {
            await Notification.create({
                recipient: new mongoose.Types.ObjectId(memberId),
                type: 'group_invite',
                sourceUser: new mongoose.Types.ObjectId(currentUserId!),
                relatedId: chatId,
                targetType: 'chat'
            });
        }

        console.log('[CHAT_ROUTE] Members added to group:', chatId);
        res.status(200).json(updatedChat);

    } catch (error) {
        console.error('Error adding members:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
}));

// Remove members from a group (admin only)
router.post('/:chatId/remove-members', authenticateToken, asyncHandler(async (req, res): Promise<void> => {
    const { chatId } = req.params;
    const { memberIds } = req.body;
    const currentUserId = req.userId;

    if (!memberIds || !Array.isArray(memberIds)) {
        res.status(400).json({ msg: 'Member IDs array is required.' });
        return;
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ msg: 'Chat not found.' });
            return;
        }

        if (!chat.isGroup) {
            res.status(400).json({ msg: 'This endpoint is only for group chats.' });
            return;
        }

        // Check if user is admin
        if (!await isGroupAdmin(chatId, currentUserId!)) {
            res.status(403).json({ msg: 'Only admins can remove members.' });
            return;
        }

        // Remove members
        chat.members = chat.members.filter((memberId: mongoose.Types.ObjectId) => 
            !memberIds.includes(memberId.toString())
        );

        // Remove from admins as well
        chat.admins = chat.admins.filter((adminId: mongoose.Types.ObjectId) => 
            !memberIds.includes(adminId.toString())
        );

        // Ensure at least one admin remains
        if (chat.admins.length === 0) {
            res.status(400).json({ msg: 'Cannot remove all admins from the group.' });
            return;
        }

        await chat.save();

        const updatedChat = await Chat.findById(chatId)
            .populate('members', 'name email profilePic')
            .populate('admins', 'name email profilePic')
            .populate({
                path: 'lastMessage',
                model: 'Message',
                populate: {
                    path: 'sender',
                    model: 'User',
                    select: 'name profilePic'
                }
            });

        console.log('[CHAT_ROUTE] Members removed from group:', chatId);
        res.status(200).json(updatedChat);

    } catch (error) {
        console.error('Error removing members:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
}));

// Add admin to a group
router.post('/:chatId/add-admin', authenticateToken, asyncHandler(async (req, res): Promise<void> => {
    const { chatId } = req.params;
    const { userId } = req.body;
    const currentUserId = req.userId;

    if (!userId) {
        res.status(400).json({ msg: 'User ID is required.' });
        return;
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ msg: 'Chat not found.' });
            return;
        }

        if (!chat.isGroup) {
            res.status(400).json({ msg: 'This endpoint is only for group chats.' });
            return;
        }

        // Check if user is admin
        if (!await isGroupAdmin(chatId, currentUserId!)) {
            res.status(403).json({ msg: 'Only admins can add other admins.' });
            return;
        }

        // Check if user is a member of the group
        if (!chat.members.includes(new mongoose.Types.ObjectId(userId))) {
            res.status(400).json({ msg: 'User must be a member of the group to become an admin.' });
            return;
        }

        // Add to admins if not already an admin
        if (!chat.admins.includes(new mongoose.Types.ObjectId(userId))) {
            chat.admins.push(new mongoose.Types.ObjectId(userId));
            await chat.save();
        }

        const updatedChat = await Chat.findById(chatId)
            .populate('members', 'name email profilePic')
            .populate('admins', 'name email profilePic')
            .populate({
                path: 'lastMessage',
                model: 'Message',
                populate: {
                    path: 'sender',
                    model: 'User',
                    select: 'name profilePic'
                }
            });

        console.log('[CHAT_ROUTE] Admin added to group:', chatId);
        res.status(200).json(updatedChat);

    } catch (error) {
        console.error('Error adding admin:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
}));

// Remove admin from a group
router.post('/:chatId/remove-admin', authenticateToken, asyncHandler(async (req, res): Promise<void> => {
    const { chatId } = req.params;
    const { userId } = req.body;
    const currentUserId = req.userId;

    if (!userId) {
        res.status(400).json({ msg: 'User ID is required.' });
        return;
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ msg: 'Chat not found.' });
            return;
        }

        if (!chat.isGroup) {
            res.status(400).json({ msg: 'This endpoint is only for group chats.' });
            return;
        }

        // Check if user is admin
        if (!await isGroupAdmin(chatId, currentUserId!)) {
            res.status(403).json({ msg: 'Only admins can remove other admins.' });
            return;
        }

        // Cannot remove yourself as admin
        if (userId === currentUserId) {
            res.status(400).json({ msg: 'Cannot remove yourself as admin.' });
            return;
        }

        // Remove from admins
        chat.admins = chat.admins.filter((adminId: mongoose.Types.ObjectId) => 
            adminId.toString() !== userId
        );

        // Ensure at least one admin remains
        if (chat.admins.length === 0) {
            res.status(400).json({ msg: 'Cannot remove all admins from the group.' });
            return;
        }

        await chat.save();

        const updatedChat = await Chat.findById(chatId)
            .populate('members', 'name email profilePic')
            .populate('admins', 'name email profilePic')
            .populate({
                path: 'lastMessage',
                model: 'Message',
                populate: {
                    path: 'sender',
                    model: 'User',
                    select: 'name profilePic'
                }
            });

        console.log('[CHAT_ROUTE] Admin removed from group:', chatId);
        res.status(200).json(updatedChat);

    } catch (error) {
        console.error('Error removing admin:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
}));

// Update group information (admin only)
router.put('/:chatId/group-info', authenticateToken, asyncHandler(async (req, res): Promise<void> => {
    const { chatId } = req.params;
    const { groupName, groupDescription, groupImage } = req.body;
    const currentUserId = req.userId;

    try {
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ msg: 'Chat not found.' });
            return;
        }

        if (!chat.isGroup) {
            res.status(400).json({ msg: 'This endpoint is only for group chats.' });
            return;
        }

        // Check if user is admin
        if (!await isGroupAdmin(chatId, currentUserId!)) {
            res.status(403).json({ msg: 'Only admins can update group information.' });
            return;
        }

        // Update group information
        if (groupName) chat.groupName = groupName;
        if (groupDescription !== undefined) chat.groupDescription = groupDescription;
        if (groupImage !== undefined) chat.groupImage = groupImage;

        await chat.save();

        const updatedChat = await Chat.findById(chatId)
            .populate('members', 'name email profilePic')
            .populate('admins', 'name email profilePic')
            .populate({
                path: 'lastMessage',
                model: 'Message',
                populate: {
                    path: 'sender',
                    model: 'User',
                    select: 'name profilePic'
                }
            });

        console.log('[CHAT_ROUTE] Group information updated:', chatId);
        res.status(200).json(updatedChat);

    } catch (error) {
        console.error('Error updating group information:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
}));

// Leave group
router.post('/:chatId/leave', authenticateToken, asyncHandler(async (req, res): Promise<void> => {
    const { chatId } = req.params;
    const currentUserId = req.userId;

    try {
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ msg: 'Chat not found.' });
            return;
        }

        if (!chat.isGroup) {
            res.status(400).json({ msg: 'This endpoint is only for group chats.' });
            return;
        }

        // Remove user from members
        chat.members = chat.members.filter((memberId: mongoose.Types.ObjectId) => 
            memberId.toString() !== currentUserId
        );

        // Remove from admins as well
        chat.admins = chat.admins.filter((adminId: mongoose.Types.ObjectId) => 
            adminId.toString() !== currentUserId
        );

        // If no members left, delete the group
        if (chat.members.length === 0) {
            await Chat.findByIdAndDelete(chatId);
            console.log('[CHAT_ROUTE] Group deleted (no members left):', chatId);
            res.status(200).json({ msg: 'Group deleted successfully.' });
            return;
        }

        // Ensure at least one admin remains
        if (chat.admins.length === 0) {
            // Make the first remaining member an admin
            chat.admins.push(chat.members[0]);
        }

        await chat.save();

        console.log('[CHAT_ROUTE] User left group:', chatId);
        res.status(200).json({ msg: 'Successfully left the group.' });

    } catch (error) {
        console.error('Error leaving group:', error);
        res.status(500).json({ msg: 'Internal Server Error', error: error });
    }
}));

// Get a specific chat by its ID
router.get('/:chatId', authenticateToken, asyncHandler(async (req, res): Promise<void> => {
    try {
        const { chatId } = req.params;

        const chat = await Chat.findById(chatId)
            .populate('members', 'name email profilePic')
            .populate('admins', 'name email profilePic')
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