const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  fileAttachment: {
    originalName: String,
    fileName: String,
    fileType: String,
    filePath: String,
    fileSize: Number
  }
});

module.exports = mongoose.model('Message', messageSchema);
