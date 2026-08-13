require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const passport = require('passport');
const connectDB = require('./config/db');
const routes = require('./routes');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport initialization
app.use(passport.initialize());
require('./config/passport')(passport);

// Routes
app.use('/api', routes);

// Simple Healthcheck
app.get('/', (req, res) => {
  res.send('MediTrack API Service is running...');
});

// Socket.io Connection Registry
const activeSockets = new Map(); // userId -> socketId
const socketToUser = new Map();  // socketId -> userId

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Register client userId to socket mapping
  socket.on('register', (userId) => {
    if (userId) {
      activeSockets.set(userId, socket.id);
      socketToUser.set(socket.id, userId);
      console.log(`Registered user: ${userId} to socket: ${socket.id}`);
    }
  });

  // Handle message sending
  socket.on('send_message', async (data) => {
    try {
      const senderId = socketToUser.get(socket.id);
      const { receiverId, content } = data;

      if (!senderId || !receiverId || !content) {
        console.error('Invalid message format received:', data);
        return;
      }

      // Save message to database
      const newMessage = new Message({
        sender: senderId,
        receiver: receiverId,
        content
      });
      await newMessage.save();

      // Emit to receiver if online
      const receiverSocketId = activeSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receive_message', newMessage);
      }

      // Emit confirmation back to sender (useful for immediate message rendering on frontend)
      socket.emit('message_sent', newMessage);

    } catch (err) {
      console.error('Socket message saving error:', err.message);
    }
  });

  // Handle Client Disconnection
  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      activeSockets.delete(userId);
      socketToUser.delete(socket.id);
      console.log(`User ${userId} disconnected, socket: ${socket.id}`);
    } else {
      console.log(`Socket disconnected: ${socket.id}`);
    }
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`MediTrack Server running on port ${PORT}`);
});
