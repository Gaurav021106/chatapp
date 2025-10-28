// 1. MODULE IMPORTS
const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const http = require('http');
// Try to require the official 'socket.io' package; if missing, provide a helpful message.
let Server;
// Socket.IO server instance will be assigned after HTTP server creation
let io;
// Map of userId -> Set of socketIds for that user (to notify specific connected clients)
const userSockets = new Map();
try {
  Server = require('socket.io').Server;
} catch (e) {
  try {
    // Fallback: some users installed a wrong package named 'socketio'. Try to require it to give a clearer error below.
    const fallback = require('socketio');
    // If fallback doesn't expose Server, set to undefined and notify user.
    Server = fallback && fallback.Server ? fallback.Server : undefined;
    console.warn("Warning: 'socketio' (without hyphen) was found. This is not the official package. It's recommended to install 'socket.io' instead: npm install socket.io");
  } catch (e2) {
    console.error("Missing required package 'socket.io'. Please install it with: npm install socket.io");
    // Exit with non-zero so the developer sees the problem instead of a confusing crash later.
    process.exit(1);
  }
}

// 2. DATABASE CONNECTION
mongoose.connect('mongodb://localhost:27017/userDB');

// 3. IMPORT MODELS
const User = require('./models/user');
const Message = require('./models/message');

// 3. MIDDLEWARE SETUP
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 4. AUTHENTICATION MIDDLEWARE
function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/');
  try {
    // Use environment variable for key in production!
    const decoded = jwt.verify(token, 'mysecretkey');
    // Fetch full user document for profile routes
    User.findById(decoded.id).then(user => {
      if (!user) return res.redirect('/');
      // Attach mongoose document for server-side operations
      req.user = user;
      // Also attach a safe plain object without sensitive fields for templates/APIs
      if (user && typeof user.toSafeObject === 'function') {
        try {
          req.userSafe = user.toSafeObject();
        } catch (e) {
          // Fallback: shallow copy and remove password
          const u = user.toObject ? user.toObject() : { ...user };
          delete u.password;
          req.userSafe = u;
        }
      } else {
        const u = user && user.toObject ? user.toObject() : user;
        if (u && u.password) delete u.password;
        req.userSafe = u;
      }
      next();
    });
  } catch (err) {
    return res.redirect('/');
  }
}

// 5. ROUTES

// Home (can be public or protected)
app.get('/home', authenticateToken, async (req, res) => {
  // Populate friends
  const user = await User.findById(req.user._id)
    .populate('friends')
    .lean();

  // Ensure arrays exist for EJS
  user.friends = user.friends || [];

  // Get last message and unread count for each friend
  const friendsWithMessages = await Promise.all(user.friends.map(async friend => {
    // Get last message between users
    const lastMessage = await Message.findOne({
      $or: [
        { from: user._id, to: friend._id },
        { from: friend._id, to: user._id }
      ]
    })
    .sort({ createdAt: -1 })
    .lean();

    // Count unread messages from this friend
    const unreadCount = await Message.countDocuments({
      from: friend._id,
      to: user._id,
      read: false
    });

    return {
      ...friend,
      lastMessage,
      unreadCount
    };
  }));

  res.render('./pages/home', { 
    user: { ...user, friends: friendsWithMessages }
  });
});

// Profile (protected) - FIXED VERSION
app.get('/profile', authenticateToken, async (req, res) => {
  const populatedUser = await User.findById(req.user._id)
    .populate('friend_requests')
    .populate('friend_requests_sent')
    .populate('friends')
    .lean();

  // FIX: Always ensure arrays exist for EJS loops to prevent forEach errors
  populatedUser.friend_requests = populatedUser.friend_requests || [];
  populatedUser.friend_requests_sent = populatedUser.friend_requests_sent || [];
  populatedUser.friends = populatedUser.friends || [];

  const allUsers = await User.find({}).lean();

  res.render('./pages/profile', {
    user_info: populatedUser,
    all_users: allUsers
  });
});

// IMPROVED: Add friend request (handles both sender and receiver)
app.post('/add-friend', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const senderId = req.user._id;

    console.log('DEBUG: /add-friend called - senderId:', senderId.toString(), 'target userId:', userId);

    // Prevent sending request to yourself
    if (senderId.toString() === userId) {
      return res.json({ success: false, message: 'Cannot send friend request to yourself' });
    }

    // Check if request already exists
    if (req.user.friend_requests_sent.includes(userId)) {
      return res.json({ success: false, message: 'Friend request already sent' });
    }

    // Check if already friends
    if (req.user.friends.includes(userId)) {
      return res.json({ success: false, message: 'Already friends' });
    }

    // Add to sender's friend_requests_sent
    await User.findByIdAndUpdate(senderId, {
      $addToSet: { friend_requests_sent: userId }
    });

    // Add to receiver's friend_requests
    await User.findByIdAndUpdate(userId, {
      $addToSet: { friend_requests: senderId }
    });

    res.json({ success: true, message: 'Friend request sent' });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.json({ success: false, message: 'Error sending friend request' });
  }
});

// IMPROVED: Cancel friend request (removes from both sender and receiver)
app.post('/cancel-friend-request', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const senderId = req.user._id;

    // Remove from sender's friend_requests_sent
    await User.findByIdAndUpdate(senderId, {
      $pull: { friend_requests_sent: userId }
    });

    // Remove from receiver's friend_requests
    await User.findByIdAndUpdate(userId, {
      $pull: { friend_requests: senderId }
    });

    res.json({ success: true, message: 'Friend request cancelled' });
  } catch (error) {
    console.error('Error cancelling friend request:', error);
    res.json({ success: false, message: 'Error cancelling friend request' });
  }
});

// NEW: Accept friend request
app.post('/accept-friend-request', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body; // userId is the person who sent the request
    const receiverId = req.user._id;

    console.log('DEBUG: /accept-friend-request called - receiverId:', receiverId.toString(), 'requester userId:', userId);

    // Add to both users' friends list
    await User.findByIdAndUpdate(receiverId, {
      $addToSet: { friends: userId },
      $pull: { friend_requests: userId }
    });

    await User.findByIdAndUpdate(userId, {
      $addToSet: { friends: receiverId },
      $pull: { friend_requests_sent: receiverId }
    });

    res.json({ success: true, message: 'Friend request accepted' });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.json({ success: false, message: 'Error accepting friend request' });
  }
});

// NEW: Decline friend request
app.post('/decline-friend-request', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body; // userId is the person who sent the request
    const receiverId = req.user._id;

    console.log('DEBUG: /decline-friend-request called - receiverId:', receiverId.toString(), 'requester userId:', userId);

    // Remove from receiver's friend_requests
    await User.findByIdAndUpdate(receiverId, {
      $pull: { friend_requests: userId }
    });

    // Remove from sender's friend_requests_sent
    await User.findByIdAndUpdate(userId, {
      $pull: { friend_requests_sent: receiverId }
    });

    res.json({ success: true, message: 'Friend request declined' });
  } catch (error) {
    console.error('Error declining friend request:', error);
    res.json({ success: false, message: 'Error declining friend request' });
  }
});

// Login page
app.get('/', (req, res) => {
  res.render('./auth/login', { error: null });
});

// Signup page
app.get('/signup', (req, res) => {
  res.render('./auth/signup', { error: null });
});

// Edit_profile page
app.get('/edit_profile', authenticateToken, (req, res) => {
  res.render('./pages/edit_profile', { user_info: req.userSafe || req.user, error: null });
});

// Update profile POST    
app.post('/update_profile', authenticateToken, async (req, res) => {
  try {
    const { bio, profile_picture, username } = req.body;
    await User.findByIdAndUpdate(req.user._id, { bio, profile_picture, username });
    res.redirect('/profile');
  } catch (error) {
    res.render('./pages/edit_profile', { user_info: req.userSafe || req.user, error: 'Error updating profile.' });
  }
});

// User signup POST
app.post('/create', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    // Prevent duplicate username/email
    const existingByEmail = await User.findByEmail(email);
    const existingByUsername = await User.findByUsername(username);
    if (existingByEmail || existingByUsername) {
      return res.render('./auth/signup', { error: 'Username or email already exists.' });
    }

    // Create user - password hashing is handled by User model pre-save middleware
    const user = new User({ username, email, password });
    await user.save();
    // Generate JWT
    const token = jwt.sign({ id: user._id }, 'mysecretkey');
    // Set JWT as cookie
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    // Redirect to home/profile
    res.redirect('/home');
  } catch (error) {
    console.error('Error creating user:', error);
    res.render('./auth/signup', { error: 'Error creating user. Username or email may already exist.' });
  }
});

// User login POST
app.post('/check', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Use model helper to find by username (case-insensitive)
    const user = await User.findByUsername(username);
    if (!user) return res.render('./auth/login', { error: 'User not found' });

    const isMatch = await user.validatePassword(password);
    if (!isMatch) return res.render('./auth/login', { error: 'Invalid username or password' });

    const token = jwt.sign({ id: user._id }, 'mysecretkey');
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    return res.redirect('/home');
  } catch (err) {
    console.error('Error during login:', err);
    return res.render('./auth/login', { error: 'An error occurred during login' });
  }
});

// Logout route
app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

// 6. SERVER START
// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
io = new Server(server);

// Track online users
const onlineUsers = new Set();

// Helper to add/remove sockets for a user
function addUserSocket(userId, socketId) {
  const set = userSockets.get(userId) || new Set();
  set.add(socketId);
  userSockets.set(userId, set);
}

function removeUserSocket(userId, socketId) {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSockets.delete(userId);
  else userSockets.set(userId, set);
}

// Socket authentication helper
function verifySocketToken(cookieHeader) {
  try {
    if (!cookieHeader) return null;
    // cookieHeader is like: "token=...; other=..."
    const parts = cookieHeader.split(';').map(p => p.trim());
    const tokenPart = parts.find(p => p.startsWith('token='));
    if (!tokenPart) return null;
    const token = tokenPart.split('=')[1];
    const decoded = jwt.verify(token, 'mysecretkey');
    return decoded && decoded.id ? decoded.id : null;
  } catch (err) {
    return null;
  }
}

io.on('connection', (socket) => {
  // Verify user from cookies
  const userId = verifySocketToken(socket.handshake.headers.cookie);
  if (!userId) {
    console.log('Socket connection rejected: invalid token');
    socket.disconnect(true);
    return;
  }
  socket.userId = userId;
  console.log('Socket connected for user', userId);
  
  // Add user to online set
  onlineUsers.add(userId.toString());
  // Track this socket for the user
  addUserSocket(userId.toString(), socket.id);
  // Broadcast to all clients that this user is online
  io.emit('user_status_change', { userId: userId.toString(), status: 'online' });

  // Join a 1:1 room. Client will emit 'join' with the other user's id
  socket.on('join', ({ otherUserId }) => {
    (async () => {
      try {
        const room = [userId.toString(), otherUserId.toString()].sort().join('_');
        socket.join(room);
        console.log(`User ${userId} joined room ${room}`);

        // When a user opens a chat (joins), mark unread messages from the other user as read
        const updateResult = await Message.updateMany(
          { from: otherUserId, to: userId, read: false },
          { read: true }
        );

        if (updateResult && (updateResult.modifiedCount > 0 || updateResult.nModified > 0)) {
          const count = updateResult.modifiedCount || updateResult.nModified || 0;
          // Notify the other user's connected sockets so they can clear unread counts
          const sockets = userSockets.get(otherUserId.toString());
          if (sockets) {
            sockets.forEach(sid => {
              io.to(sid).emit('messages_read', {
                readerId: userId.toString(),
                conversationWith: otherUserId.toString(),
                count
              });
            });
          }
        }
      } catch (err) {
        console.error('Error joining room', err);
      }
    })();
  });

  // Handle sending messages
  socket.on('send_message', async (payload) => {
    try {
      const { to, content } = payload;
      if (!to || !content) return;
      // Save message
      const msg = new Message({ from: userId, to, content });
      await msg.save();

      const room = [userId.toString(), to.toString()].sort().join('_');
      // Emit to room so both participants get it
      io.to(room).emit('new_message', {
        _id: msg._id,
        from: msg.from,
        to: msg.to,
        content: msg.content,
        createdAt: msg.createdAt
      });
    } catch (err) {
      console.error('Error handling send_message', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected for user', userId);
    // Remove user from online set
    onlineUsers.delete(userId.toString());
    // Remove this socket from user's socket map
    removeUserSocket(userId.toString(), socket.id);
    // Broadcast to all clients that this user is offline
    io.emit('user_status_change', { userId: userId.toString(), status: 'offline' });
  });
});

// Route to get initial online users
app.get('/online-users', authenticateToken, (req, res) => {
  res.json({ users: Array.from(onlineUsers) });
});

// Route to fetch chat messages between authenticated user and another user
app.get('/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const otherId = req.params.userId;
    const me = req.user._id;
    
    // Mark messages from other user as read
    const updateResult = await Message.updateMany(
      { from: otherId, to: me, read: false },
      { read: true }
    );

    // If any messages were marked read, notify the sender's connected sockets so they can update unread counts
    if (updateResult && (updateResult.modifiedCount > 0 || updateResult.nModified > 0)) {
      const count = updateResult.modifiedCount || updateResult.nModified || 0;
      const sockets = userSockets.get(otherId.toString());
      if (sockets) {
        sockets.forEach(sid => {
          io.to(sid).emit('messages_read', {
            readerId: me.toString(),
            conversationWith: otherId.toString(),
            count
          });
        });
      }
    }
    
    const messages = await Message.find({
      $or: [
        { from: me, to: otherId },
        { from: otherId, to: me }
      ]
    }).sort({ createdAt: 1 }).lean();
    res.json({ success: true, messages });
  } catch (err) {
    console.error('Error fetching messages', err);
    res.json({ success: false, message: 'Error fetching messages' });
  }
});

const PORT = process.env.PORT || 2000;

server.listen(PORT, () => {
  console.log(`server (with socket.io) is running on port ${PORT}`);
});

// Handle listen errors (e.g., port already in use) more gracefully
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please stop the process using it or set a different PORT.`);
    // Exit so nodemon can restart cleanly, or so the operator can fix the issue
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown handlers
function gracefulShutdown() {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  // Force close if not closed within 5s
  setTimeout(() => {
    console.error('Forcing server shutdown');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
