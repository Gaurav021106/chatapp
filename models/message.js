const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  file: {
    fileName: String,
    originalName: String,
    fileType: String,
    fileSize: Number,
    url: String
  }
});

module.exports = mongoose.model('Message', MessageSchema);
