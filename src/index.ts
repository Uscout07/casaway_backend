// Updated index.ts with Socket.IO support
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/userRoutes';
import cookieParser from 'cookie-parser';
import protectedRoutes from './routes/protected';
import chatRoutes from './routes/chatRoutes';
import messageRoutes from './routes/messageRoutes';
import listingRoutes from './routes/listingRoutes';
import postRoutes from './routes/postRoutes';
import followRoutes from './routes/followRoutes';
import likeRoutes from './routes/likeRoutes';
import commentRoutes from './routes/commentRoutes';
import savedPostRoutes from './routes/savedPostRoutes';




// Import Chat model directly at the top for consistency
import Chat from './models/Chat'; // Assuming Chat.ts exports default Chat model

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    // Add your production frontend URL here
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
};

app.use(cors(corsOptions));
console.log(`[BACKEND] CORS configured for origins: ${corsOptions.origin.join(', ')}`);


// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: corsOptions
});
console.log('[BACKEND] Socket.IO server initialized.');

// Socket.IO connection handling
const connectedUsers = new Map<string, string>(); // Map userId to socket.id

io.on('connection', (socket) => {
  console.log(`[BACKEND] User connected: Socket ID ${socket.id}`);

  // Join user to their personal room for notifications
  socket.on('join-user', (userId: string) => {
    if (userId) {
      connectedUsers.set(userId, socket.id);
      socket.join(`user-${userId}`);
      console.log(`[BACKEND] User ${userId} joined their personal room (socket: ${socket.id}). Total connected users in map: ${connectedUsers.size}`);
    } else {
      console.warn(`[BACKEND] 'join-user' event received with no userId.`);
    }
  });

  // Join chat room
  socket.on('join-chat', (chatId: string) => {
    socket.join(`chat-${chatId}`);
    console.log(`[BACKEND] Socket ${socket.id} joined chat room: ${chatId}`);
  });

  // Handle sending messages (real-time broadcasting)
  socket.on('send-message', async (data: { chatId: string, message: any }) => {
    console.log(`[BACKEND] 'send-message' event received from socket ${socket.id} for chat ${data.chatId}.`);
    const { chatId, message } = data;

    // Broadcast message to all users in the chat room (excluding the sender's socket)
    socket.to(`chat-${chatId}`).emit('new-message', message);
    console.log(`[BACKEND] Message ${message._id} broadcast to chat-${chatId} (excluding sender).`);

    // Also send to individual user rooms for notifications
    try {
      const chat = await Chat.findById(chatId).populate('members');

      if (chat) {
        interface ChatMember {
          _id: mongoose.Types.ObjectId;
        }

        const messageWithChatId = { ...message, chat: chatId };

        chat.members.forEach((member: ChatMember) => {
          const memberIdString = member._id.toString();
          const memberSocketId: string | undefined = connectedUsers.get(memberIdString);
          if (memberSocketId && memberSocketId !== socket.id) {
            io.to(`user-${memberIdString}`).emit('new-message', messageWithChatId);
            console.log(`[BACKEND] Message ${message._id} sent to user-${memberIdString} for notification.`);
          } else if (!memberSocketId) {
            console.log(`[BACKEND] User ${memberIdString} not found in connectedUsers map for notification.`);
          } else {
            console.log(`[BACKEND] User ${memberIdString} is the sender or in the same chat room, not sending direct notification.`);
          }
        });
      } else {
        console.warn(`[BACKEND] Chat ${chatId} not found when trying to broadcast message to individual users.`);
      }
    } catch (error) {
      console.error('[BACKEND] Error broadcasting message to individual users:', error);
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    console.log(`[BACKEND] Typing event from user ${data.userId} in chat ${data.chatId}`);
    socket.to(`chat-${data.chatId}`).emit('user-typing', {
      userId: data.userId,
      userName: data.userName
    });
  });

  socket.on('stop-typing', (data) => {
    console.log(`[BACKEND] Stop typing event from user ${data.userId} in chat ${data.chatId}`);
    socket.to(`chat-${data.chatId}`).emit('user-stop-typing', {
      userId: data.userId
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[BACKEND] User disconnected: Socket ID ${socket.id}, Reason: ${reason}`);
    // Remove user from connected users map
    let userIdRemoved: string | null = null;
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        userIdRemoved = userId;
        break;
      }
    }
    if (userIdRemoved) {
      console.log(`[BACKEND] User ${userIdRemoved} removed from connectedUsers map. Remaining: ${connectedUsers.size}`);
    } else {
      console.log(`[BACKEND] Disconnected socket ${socket.id} not found in connectedUsers map.`);
    }
  });

  socket.on('error', (error) => {
    console.error(`[BACKEND] Socket error for ${socket.id}:`, error);
  });
});

// Make io available to routes (though for messages, it's better to use socket.on('send-message'))
app.set('io', io);
console.log('[BACKEND] Socket.IO instance set on app.');

app.use(cookieParser());
app.use(express.json());
console.log('[BACKEND] Middleware: cookieParser and express.json enabled.');


// Routes
app.use('/api/protected', protectedRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/listing', listingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/saved-posts', savedPostRoutes);
console.log('[BACKEND] All API routes mounted.');


// Start server
server.listen(PORT, () => {
  console.log(`[BACKEND] Server running on http://localhost:${PORT}`);
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || '')
  .then(() => console.log('[BACKEND] MongoDB connected successfully'))
  .catch(err => console.error('[BACKEND] MongoDB connection error:', err));

export default app;