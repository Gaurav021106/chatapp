require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const User = require('./models/user');
const Message = require('./models/message');
const Group = require('./models/group');
const authenticateToken = require('./middleware/auth');

// Import Route Modules
const groupRoutes = require('./routes/groups');
const chatRoutes = require('./routes/chat');
const aiRoutes = require('./routes/ai');

// Safely require upload middleware
let profileUpload;
try {
  const uploadModule = require('./middleware/upload');
  profileUpload = uploadModule.profileUpload || uploadModule;
} catch (e) {
  console.warn("Upload middleware not found, file uploads might fail.");
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.set('io', io);

// 1. DATABASE CONNECTION
const primaryDbUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatapp';
mongoose.connect(primaryDbUrl, { connectTimeoutMS: 10000 })
  .then(() => console.log('Connected to MongoDB successfully!'))
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });

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

// --- AUTHENTICATION ROUTES ---

app.get('/', (req, res) => res.redirect('/login'));
app.get('/signup', (req, res) => res.render('auth/signup', { error: null }));
app.get('/login', (req, res) => res.render('auth/login', { error: null }));

// DIRECT SIGNUP POST
app.post('/signup', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
      return res.render('auth/signup', { error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username: new RegExp('^' + username + '$', 'i') }] 
    });

    if (existingUser) {
      return res.render('auth/signup', { error: 'Username or Email is already taken' });
    }

    const user = new User({ username, email, password });
    await user.save(); // Password hashes automatically in models/user.js

    const token = jwt.sign({ id: user._id }, process.env.JWTSECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/home');

  } catch (error) {
    console.error(error);
    res.render('auth/signup', { error: 'Error creating account. Please try again.' });
  }
});

// DIRECT LOGIN POST
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.render('auth/login', { error: 'Username/Email and password are required' });
    }
    
    const user = await User.findOne({
      $or: [
        { email: username.toLowerCase() },
        { username: new RegExp('^' + username + '$', 'i') }
      ]
    });

    if (!user || !(await user.validatePassword(password))) {
      return res.render('auth/login', { error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user._id }, process.env.JWTSECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/home');

  } catch (error) {
    console.error(error);
    res.render('auth/login', { error: 'An error occurred during login' });
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

// --- PROTECTED PAGES ---

app.get('/home', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id).populate('friends').lean();
  res.render('pages/home', { user });
});

app.get('/profile', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id).populate('friends friend_requests friend_requests_sent').lean();
  const allUsers = await User.find({ _id: { $ne: req.user._id } }).limit(10).lean();
  res.render('pages/profile', { user_info: user, all_users: allUsers });
});

app.get('/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    if (!otherUserId) return res.status(400).json({ success: false, message: 'User ID is required' });

    const otherUser = await User.findById(otherUserId);
    if (!otherUser) return res.status(404).json({ success: false, message: 'User not found' });

    const messages = await Message.find({
      $or: [
        { from: req.user._id, to: otherUserId },
        { from: otherUserId, to: req.user._id }
      ]
    }).sort({ createdAt: 1 }).lean();

    return res.json({ success: true, messages });
  } catch (error) {
    console.error('Fetch messages error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching messages.' });
  }
});

app.get('/edit_profile', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  if (!user) {
    return res.redirect('/profile');
  }
  res.render('pages/edit_profile', { user, error: null });
});

app.post('/add-friend', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot add yourself' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    if (req.user.friends.some(id => id.toString() === userId)) {
      return res.status(400).json({ success: false, message: 'You are already friends' });
    }

    if (req.user.friend_requests_sent.some(id => id.toString() === userId)) {
      return res.status(400).json({ success: false, message: 'Friend request already sent' });
    }

    if (req.user.friend_requests.some(id => id.toString() === userId)) {
      return res.status(400).json({ success: false, message: 'This user has already sent you a friend request' });
    }

    req.user.friend_requests_sent.push(targetUser._id);
    targetUser.friend_requests.push(req.user._id);

    await req.user.save();
    await targetUser.save();

    res.json({ success: true, message: 'Friend request sent' });
  } catch (error) {
    console.error('Add friend error:', error);
    res.status(500).json({ success: false, message: 'Unable to send friend request' });
  }
});

app.post('/cancel-friend-request', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    req.user.friend_requests_sent = req.user.friend_requests_sent.filter(id => id.toString() !== userId);
    targetUser.friend_requests = targetUser.friend_requests.filter(id => id.toString() !== req.user._id.toString());

    await req.user.save();
    await targetUser.save();

    res.json({ success: true, message: 'Friend request cancelled' });
  } catch (error) {
    console.error('Cancel friend request error:', error);
    res.status(500).json({ success: false, message: 'Unable to cancel friend request' });
  }
});

app.post('/accept-friend', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });

    const requester = await User.findById(userId);
    if (!requester) return res.status(404).json({ success: false, message: 'User not found' });

    if (!req.user.friend_requests.some(id => id.toString() === userId)) {
      return res.status(400).json({ success: false, message: 'No friend request from this user' });
    }

    req.user.friend_requests = req.user.friend_requests.filter(id => id.toString() !== userId);
    requester.friend_requests_sent = requester.friend_requests_sent.filter(id => id.toString() !== req.user._id.toString());

    if (!req.user.friends.some(id => id.toString() === userId)) {
      req.user.friends.push(requester._id);
    }
    if (!requester.friends.some(id => id.toString() === req.user._id.toString())) {
      requester.friends.push(req.user._id);
    }

    await req.user.save();
    await requester.save();

    res.json({ success: true, message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend error:', error);
    res.status(500).json({ success: false, message: 'Unable to accept friend request' });
  }
});

app.post('/reject-friend', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });

    const requester = await User.findById(userId);
    if (!requester) return res.status(404).json({ success: false, message: 'User not found' });

    req.user.friend_requests = req.user.friend_requests.filter(id => id.toString() !== userId);
    requester.friend_requests_sent = requester.friend_requests_sent.filter(id => id.toString() !== req.user._id.toString());

    await req.user.save();
    await requester.save();

    res.json({ success: true, message: 'Friend request rejected' });
  } catch (error) {
    console.error('Reject friend error:', error);
    res.status(500).json({ success: false, message: 'Unable to reject friend request' });
  }
});

// EDIT PROFILE POST ROUTE
app.post('/edit_profile', authenticateToken, (req, res, next) => {
  // 1. Handle Multer errors gracefully so the app doesn't crash
  profileUpload.single('profileImage')(req, res, function (err) {
    if (err) {
      return res.render('pages/edit_profile', { user: req.user, error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { username, email, bio, password, confirm_password } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) return res.render('pages/edit_profile', { user: req.user, error: 'User not found' });
    
    // 2. Safely check if the new username is already taken by someone else
    if (username && username.trim() !== user.username) {
      const existingUser = await User.findOne({ username: new RegExp('^' + username.trim() + '$', 'i') });
      if (existingUser) {
        return res.render('pages/edit_profile', { user, error: 'That username is already taken. Please choose another.' });
      }
      user.username = username.trim();
    }

    // 3. Safely update email
    if (email && email.trim().toLowerCase() !== user.email) {
      const existingEmailUser = await User.findOne({ email: email.trim().toLowerCase() });
      if (existingEmailUser) {
        return res.render('pages/edit_profile', { user, error: 'Email is already in use by another account.' });
      }
      user.email = email.trim().toLowerCase();
    }
    
    // 4. Update bio safely
    if (bio !== undefined) user.bio = bio.trim();

    // 5. Update password only when provided and confirmed
    if (password) {
      if (password.length < 6) {
        return res.render('pages/edit_profile', { user, error: 'Password must be at least 6 characters long.' });
      }
      if (password !== confirm_password) {
        return res.render('pages/edit_profile', { user, error: 'Passwords do not match.' });
      }
      user.password = password;
    }
    
    // 6. Update profile picture if a new valid image was uploaded
    if (req.file) {
      user.profile_picture = '/images/profile_pictures/' + req.file.filename;
    }
    
    await user.save();
    res.redirect('/profile'); // Send them back to their profile to see the changes!
  } catch (error) {
    console.error("Profile Edit Error: ", error);
    res.render('pages/edit_profile', { user: req.user, error: 'Error updating profile. Please try again.' });
  }
});
// 4. SOCKET.IO LOGIC
const userSockets = new Map();

io.on('connection', (socket) => {
  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) return socket.disconnect();
  
  let token = null;
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name === 'token') token = value;
  });
  
  if (!token) return socket.disconnect();

  try {
    const decoded = jwt.verify(token, process.env.JWTSECRET);
    const userId = decoded.id;
    socket.userId = userId;
    socket.join(`private:${userId}`);
    
    if(!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);
    io.emit('user_status_change', { userId, status: 'online' });

    socket.on('join', ({ groupId }) => {
      if (groupId) {
        socket.join(`group:${groupId}`);
      }
    });

    socket.on('send_message', async ({ to, content, fileAttachment, isGroup }) => {
      try {
        if (!to) return;
        const trimmedContent = typeof content === 'string' ? content.trim() : '';
        const messageContent = trimmedContent || (fileAttachment ? '(attachment)' : '');
        if (!messageContent && !fileAttachment) return;

        if (isGroup) {
          const group = await Group.findById(to);
          if (!group) return;
          if (!group.members.map(String).includes(userId.toString())) return;

          group.messages.push({ sender: userId, content: messageContent, file: fileAttachment || null });
          await group.save();
          const newMessage = group.messages[group.messages.length - 1];
          await Group.populate(newMessage, { path: 'sender', select: 'username profile_picture' });

          io.to(`group:${to}`).emit('group_message', {
            groupId: to,
            message: newMessage
          });
          return;
        }

        const sender = await User.findById(userId).select('username profile_picture');
        const recipient = await User.findById(to).select('username profile_picture');
        if (!recipient) return;

        const savedMessage = await Message.create({
          from: userId,
          to,
          content: messageContent,
          file: fileAttachment || null
        });

        const msgPayload = {
          _id: savedMessage._id,
          from: savedMessage.from.toString(),
          to: savedMessage.to.toString(),
          content: savedMessage.content,
          file: savedMessage.file,
          createdAt: savedMessage.createdAt,
          senderName: sender.username,
          senderProfilePicture: sender.profile_picture
        };

        socket.emit('message', msgPayload);
        socket.emit('new_message', msgPayload);
        io.to(`private:${to}`).emit('message', msgPayload);
        io.to(`private:${to}`).emit('new_message', msgPayload);
      } catch (err) {
        console.error('Error handling send_message:', err);
      }
    });

    socket.on('disconnect', () => {
      const userSet = userSockets.get(userId);
      if (userSet) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          userSockets.delete(userId);
          io.emit('user_status_change', { userId, status: 'offline' });
        }
      }
    });
  } catch (err) {
    socket.disconnect();
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));