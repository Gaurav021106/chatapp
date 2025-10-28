const express = require('express');
const router = express.Router();
const Group = require('../models/group');
const authenticateToken = require('../middleware/auth');
const { groupUpload } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

// Create a new group
router.post('/create', authenticateToken, groupUpload.single('groupImage'), async (req, res) => {
    try {
        const { name, description } = req.body;
        const members = req.body.members ? (Array.isArray(req.body.members) ? req.body.members : [req.body.members]) : [];

        // Validate input
        if (!name || members.length === 0) {
            // Delete uploaded file if exists
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({
                success: false,
                message: 'Invalid group data. Name and at least one member are required.'
            });
        }

        // Prepare group data
        const groupData = {
            name,
            description,
            creator: req.user._id,
            members: [...members, req.user._id] // Add creator to members list
        };

        // Add group picture if uploaded
        if (req.file) {
            groupData.group_picture = '/images/group_pictures/' + req.file.filename;
        }

        // Create new group with current user as creator and member
        const group = new Group(groupData);

        await group.save();

        // Populate member details for immediate use
        await group.populate('members', 'username profile_picture');

        return res.json({
            success: true,
            message: 'Group created successfully',
            group
        });
    } catch (error) {
        console.error('Error creating group:', error);
        return res.status(500).json({
            success: false,
            message: 'Error creating group. Please try again.'
        });
    }
});

// Get user's groups
router.get('/', authenticateToken, async (req, res) => {
    try {
        const groups = await Group.find({
            members: req.user._id
        })
        .populate('members', 'username profile_picture')
        .populate('creator', 'username profile_picture')
        .sort({ createdAt: -1 });

        return res.json({
            success: true,
            groups
        });
    } catch (error) {
        console.error('Error fetching groups:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching groups. Please try again.'
        });
    }
});

// Get group messages
router.get('/:groupId/messages', authenticateToken, async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId)
            .populate('messages.sender', 'username profile_picture');

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if user is a member
        if (!group.members.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        return res.json({
            success: true,
            messages: group.messages
        });
    } catch (error) {
        console.error('Error fetching group messages:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching messages. Please try again.'
        });
    }
});

// Add message to group
router.post('/:groupId/messages', authenticateToken, async (req, res) => {
    try {
        const { content } = req.body;
        const groupId = req.params.groupId;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'Message content is required'
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if user is a member
        if (!group.members.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        // Add message
        group.messages.push({
            sender: req.user._id,
            content
        });

        await group.save();

        // Populate sender details for the new message
        const newMessage = group.messages[group.messages.length - 1];
        await Group.populate(newMessage, {
            path: 'sender',
            select: 'username profile_picture'
        });

        // Emit to all group members via Socket.IO
        req.app.get('io').to(`group:${groupId}`).emit('group_message', {
            groupId,
            message: newMessage
        });

        return res.json({
            success: true,
            message: newMessage
        });
    } catch (error) {
        console.error('Error adding message:', error);
        return res.status(500).json({
            success: false,
            message: 'Error adding message. Please try again.'
        });
    }
});

module.exports = router;