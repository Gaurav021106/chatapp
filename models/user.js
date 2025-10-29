const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  profile_picture: { 
    type: String, 
    default: './images/profile.jpg'
  },
  bio: { 
    type: String, 
    default: '',
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
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
  }],
  last_seen: {
    type: Date,
    default: Date.now
  }
  
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Index for faster queries
userSchema.index({ username: 1, email: 1 });

// Virtual for full profile URL
userSchema.virtual('profile_picture_url').get(function() {
  if (this.profile_picture.startsWith('http')) {
    return this.profile_picture;
  }
  return `${process.env.APP_URL || 'http://localhost:2000'}${this.profile_picture}`;
});

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByUsername = function(username) {
  return this.findOne({ username: new RegExp('^' + username + '$', 'i') });
};

// Instance methods
userSchema.methods.validatePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getFriendStatus = function(userId) {
  const id = userId.toString();
  if (this.friends.some(fid => fid.toString() === id)) return 'friend';
  if (this.friend_requests.some(fid => fid.toString() === id)) return 'pending_incoming';
  if (this.friend_requests_sent.some(fid => fid.toString() === id)) return 'pending_outgoing';
  return 'none';
};

userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

// Middleware
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase();
  }
  next();
});

userSchema.pre('save', function(next) {
  if (this.isModified('username')) {
    this.username = this.username.trim();
  }
  next();
});

// Export model and types for TypeScript
/**
 * @typedef {import('mongoose').Document} Document
 * @typedef {Object} IUser
 * @property {string} username
 * @property {string} email
 * @property {string} password
 * @property {string} profile_picture
 * @property {string} bio
 * @property {Array<string>} friends
 * @property {Array<string>} friend_requests
 * @property {Array<string>} friend_requests_sent
 * @property {Date} last_seen
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/** @type {import('mongoose').Model<Document & IUser>} */
const User = mongoose.model('User', userSchema);

module.exports = User;