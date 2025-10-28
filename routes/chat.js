const express = require('express');
const router = express.Router();
const Message = require('../models/message');
const upload = require('../middleware/chatUpload');
const authenticateToken = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

// Route to handle file uploads in chat
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Return file details
        res.json({
            success: true,
            file: {
                originalName: req.file.originalname,
                fileName: req.file.filename,
                fileType: req.file.mimetype,
                filePath: '/uploads/chat/' + req.file.filename,
                fileSize: req.file.size
            }
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading file'
        });
    }
});

// Route to serve uploaded files
router.get('/download/:filename', authenticateToken, (req, res) => {
    const filePath = path.join(__dirname, '..', 'public', 'uploads', 'chat', req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({
            success: false,
            message: 'File not found'
        });
    }
});

module.exports = router;