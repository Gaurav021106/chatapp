// 1. MODULE IMPORTS
const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// 2. DATABASE MODEL
mongoose.connect('mongodb://localhost:27017/userDB');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profile_picture: { type: String, default: './images/profile.jpg' },
  bio:      { type: String, default: '' },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],
  friend_requests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],
  friend_requests_sent: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }]
});

const User = mongoose.model('User', userSchema);

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
      req.user = user;
      next();
    });
  } catch (err) {
    return res.redirect('/');
  }
}

// 5. ROUTES

// Home (can be public or protected)
app.get('/home', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('friends')
    .lean();

  // Ensure arrays exist for EJS
  user.friends = user.friends || [];

  res.render('./pages/home', { user });
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
  res.render('./pages/edit_profile', { user_info: req.user, error: null });
});

// Update profile POST    
app.post('/update_profile', authenticateToken, async (req, res) => {
  try {
    const { bio, profile_picture, username } = req.body;
    await User.findByIdAndUpdate(req.user._id, { bio, profile_picture, username });
    res.redirect('/profile');
  } catch (error) {
    res.render('./pages/edit_profile', { user_info: req.user, error: 'Error updating profile.' });
  }
});

// User signup POST
app.post('/create', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create user
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    // Generate JWT
    const token = jwt.sign({ id: user._id }, 'mysecretkey');
    // Set JWT as cookie
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    // Redirect to home/profile
    res.redirect('/home');
  } catch (error) {
    res.render('./auth/signup', { error: 'Error creating user. Username or email may already exist.' });
  }
});

// User login POST
app.post('/check', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user) {
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      const token = jwt.sign({ id: user._id }, 'mysecretkey');
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
      return res.redirect('/home');
    } else {
      return res.render('./auth/login', { error: 'Invalid username or password' });
    }
  } else {
    return res.render('./auth/login', { error: 'User not found' });
  }
});

// Logout route
app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

// 6. SERVER START
app.listen(2000, () => {
  console.log('server is running on port 2000');
});
