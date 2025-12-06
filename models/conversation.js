const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user','assistant','system'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ConversationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  messages: { type: [MessageSchema], default: [] },
  updatedAt: { type: Date, default: Date.now }
});

ConversationSchema.methods.append = async function(role, content) {
  this.messages.push({ role, content });
  this.updatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Conversation', ConversationSchema);
