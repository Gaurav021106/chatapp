// Load environment variables
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const fs = require('fs');

const User = require('./models/user');
const Message = require('./models/message');
const Group = require('./models/group');
const JWTSECRET = require('./config/jwt');
const authenticateToken = require('./middleware/auth');

// Import Route Modules
const groupRoutes = require('./routes/groups');
const chatRoutes = require('./routes/chat');
const aiRoutes = require('./routes/ai');
const { profileUpload } = require('./middleware/upload');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 1. DATABASE CONNECTION
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatapp')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB error:', err));

// 2. MIDDLEWARE & SETTINGS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. ROUTES
app.use('/chat', chatRoutes);
app.use('/groups', groupRoutes);
app.use('/api', aiRoutes);

// Auth Routes
app.get('/', (req, res) => res.render('auth/login', { error: null }));
app.get('/signup', (req, res) => res.render('auth/signup', { error: null }));

app.post('/create', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // Input validation
    if (!username || !password || !email) {
      return res.render('auth/signup', { error: 'All fields are required' });
    }
    if (username.length < 3) {
      return res.render('auth/signup', { error: 'Username must be at least 3 characters' });
    }
    if (password.length < 6) {
      return res.render('auth/signup', { error: 'Password must be at least 6 characters' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.render('auth/signup', { error: 'Invalid email format' });
    }
    
    const user = new User({ username, email, password });
    await user.save();
    const token = jwt.sign({ id: user._id }, JWTSECRET);
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/home');
  } catch (error) {
    res.render('auth/signup', { error: error.message });
  }
});

app.post('/check', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Input validation
    if (!username || !password) {
      return res.render('auth/login', { error: 'Username and password are required' });
    }
    
    const user = await User.findByUsername(username);
    if (!user || !(await user.validatePassword(password))) {
      return res.render('auth/login', { error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user._id }, JWTSECRET);
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/home');
  } catch (error) {
    res.render('auth/login', { error: 'An error occurred during login' });
  }
});

app.get('/home', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id).populate('friends').lean();
  res.render('pages/home', { user });
});

app.get('/profile', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id).populate('friends friend_requests').lean();
  const allUsers = await User.find({ _id: { $ne: req.user._id } }).limit(10).lean();
  res.render('pages/profile', { user_info: user, all_users: allUsers });
});

app.get('/messages/:friendId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const friendId = req.params.friendId;

    const friend = await User.findById(friendId);
    if (!friend) return res.status(404).json({ success: false, message: 'Friend not found' });

    // Load all direct messages both ways
    const messages = await Message.find({
      $or: [
        { from: userId, to: friendId },
        { from: friendId, to: userId }
      ]
    })
      .sort({ createdAt: 1 })
      .populate('from', 'username')
      .populate('to', 'username')
      .lean();

    const formatted = messages.map(m => ({
      ...m,
      from_username: m.from ? m.from.username : '',
      to_username: m.to ? m.to.username : ''
    }));

    return res.json({ success: true, messages: formatted });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch messages' });
  }
});

app.get('/edit_profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    if (!user) return res.status(404).render('auth/login', { error: 'User not found' });
    res.render('pages/edit_profile', { user });
  } catch (error) {
    res.status(500).render('auth/login', { error: 'Error loading profile' });
  }
});

app.post('/edit_profile', authenticateToken, profileUpload.single('profileImage'), async (req, res) => {
  try {
    const { username, bio } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) return res.render('pages/edit_profile', { user: req.user, error: 'User not found' });
    
    if (username && username.length >= 3) user.username = username;
    if (bio !== undefined) user.bio = bio;
    
    // Handle profile picture upload
    if (req.file) {
      user.profile_picture = '/images/profile_pictures/' + req.file.filename;
    }
    
    await user.save();
    // Redirect to profile page after successful update
    res.redirect('/profile');
  } catch (error) {
    res.render('pages/edit_profile', { user: req.user, error: 'Error updating profile: ' + error.message });
  }
});

// Logout Route
app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

// Friend Management Routes
app.post('/add-friend', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot add yourself as friend' });
    }
    
    const currentUser = await User.findById(req.user._id);
    const targetUser = await User.findById(userId);
    
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    
    // Check if already friends
    if (currentUser.friends.some(id => id.toString() === userId)) {
      return res.status(400).json({ success: false, message: 'Already friends' });
    }
    
    // Check if request already sent
    if (currentUser.friend_requests_sent.some(id => id.toString() === userId)) {
      return res.status(400).json({ success: false, message: 'Request already sent' });
    }
    
    currentUser.friend_requests_sent.push(userId);
    targetUser.friend_requests.push(req.user._id);
    
    await currentUser.save();
    await targetUser.save();
    
    res.json({ success: true, message: 'Friend request sent' });
  } catch (error) {
    console.error('Add friend error:', error);
    res.status(500).json({ success: false, message: 'Error sending request' });
  }
});

app.post('/accept-friend', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });
    
    const currentUser = await User.findById(req.user._id);
    const requesterUser = await User.findById(userId);
    
    if (!requesterUser) return res.status(404).json({ success: false, message: 'User not found' });
    
    // Remove from friend requests and add to friends
    currentUser.friend_requests = currentUser.friend_requests.filter(id => id.toString() !== userId);
    requesterUser.friend_requests_sent = requesterUser.friend_requests_sent.filter(id => id.toString() !== req.user._id.toString());
    
    if (!currentUser.friends.some(id => id.toString() === userId)) {
      currentUser.friends.push(userId);
    }
    if (!requesterUser.friends.some(id => id.toString() === req.user._id.toString())) {
      requesterUser.friends.push(req.user._id);
    }
    
    await currentUser.save();
    await requesterUser.save();
    
    res.json({ success: true, message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend error:', error);
    res.status(500).json({ success: false, message: 'Error accepting request' });
  }
});

app.post('/reject-friend', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });
    
    const currentUser = await User.findById(req.user._id);
    const requesterUser = await User.findById(userId);
    
    if (!requesterUser) return res.status(404).json({ success: false, message: 'User not found' });
    
    // Remove from friend requests
    currentUser.friend_requests = currentUser.friend_requests.filter(id => id.toString() !== userId);
    requesterUser.friend_requests_sent = requesterUser.friend_requests_sent.filter(id => id.toString() !== req.user._id.toString());
    
    await currentUser.save();
    await requesterUser.save();
    
    res.json({ success: true, message: 'Friend request rejected' });
  } catch (error) {
    console.error('Reject friend error:', error);
    res.status(500).json({ success: false, message: 'Error rejecting request' });
  }
});

// 4. SOCKET.IO LOGIC
const userSockets = new Map(); // userId -> Set(socketIds)

function broadcastUserStatus(userId, status) {
  io.emit('user_status_change', { userId, status });
}

app.get('/online-users', (req, res) => {
  try {
    const users = Array.from(userSockets.keys());
    res.json({ success: true, users });
  } catch (err) {
    console.error('Online users error:', err);
    res.status(500).json({ success: false, message: 'Unable to fetch online users' });
  }
});

app.get('/online-status', (req, res) => {
  try {
    const onlineUserIds = Array.from(userSockets.keys());
    res.json({ success: true, onlineUserIds });
  } catch (err) {
    console.error('Online status error:', err);
    res.status(500).json({ success: false, message: 'Unable to get online status' });
  }
});

io.on('connection', (socket) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) return socket.disconnect();
    
    // Safely extract token from cookies
    let token = null;
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'token') {
        token = value;
        break;
      }
    }
    
    if (!token) return socket.disconnect();

    try {
      const decoded = jwt.verify(token, JWTSECRET);
      const userId = decoded.id;
      socket.userId = userId;
      
      const isNewOnline = !userSockets.has(userId);
      if(!userSockets.has(userId)) userSockets.set(userId, new Set());
      userSockets.get(userId).add(socket.id);
      if (isNewOnline) {
        broadcastUserStatus(userId, 'online');
      }

      socket.on('join', ({ otherUserId, groupId }) => {
        if (groupId) socket.join(`group:${groupId}`);
        else if (otherUserId) {
          const room = [userId, otherUserId].sort().join('_');
          socket.join(room);
        }
      });

      socket.on('send_message', async (payload) => {
        try {
          const { to, content, isGroup, fileAttachment } = payload;
          
          // Validate payload
          if (!to || !content) {
            return socket.emit('error', { message: 'Missing required fields' });
          }
          
          if (isGroup) {
            const group = await Group.findById(to);
            if (!group) return socket.emit('error', { message: 'Group not found' });
            
            const msgObj = { sender: userId, content, file: fileAttachment };
            group.messages.push(msgObj);
            await group.save();
            io.to(`group:${to}`).emit('group_message', { groupId: to, message: msgObj });
          } else {
            // Validate recipient exists
            const recipient = await User.findById(to);
            if (!recipient) return socket.emit('error', { message: 'User not found' });
            
            const msg = new Message({ from: userId, to, content, file: fileAttachment });
            await msg.save();
            const room = [userId, to].sort().join('_');
            io.to(room).emit('new_message', msg);
          }
        } catch (err) {
          console.error('Error sending message:', err);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      socket.on('disconnect', () => {
        const userSet = userSockets.get(userId);
        if (userSet) {
          userSet.delete(socket.id);
          if (userSet.size === 0) {
            userSockets.delete(userId);
            broadcastUserStatus(userId, 'offline');
          }
        }
      });
    } catch (err) {
      socket.disconnect();
    }
  } catch (err) {
    socket.disconnect();
  }
});

// Status API for UI: online / offline
app.get('/online-status', (req, res) => {
  try {
    const onlineUserIds = Array.from(userSockets.keys());
    res.json({ success: true, onlineUserIds });
  } catch (err) {
    console.error('Online status error:', err);
    res.status(500).json({ success: false, message: 'Unable to get online status' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));