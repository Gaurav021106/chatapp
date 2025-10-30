const express = require('express');
const router = express.Router();
const Group = require('../models/group');
const authenticateToken = require('../middleware/auth');
const { groupUpload } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

// ----------- CREATE GROUP -----------
router.post('/create', authenticateToken, groupUpload.single('groupImage'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const members = req.body.members ? (Array.isArray(req.body.members) ? req.body.members : [req.body.members]) : [];
    if (!name || members.length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Name and at least one member are required.' });
    }
    const groupData = {
      name,
      description,
      creator: req.user._id,
      members: [...new Set([...members, req.user._id.toString()])]
    };
    if (req.file) groupData.group_picture = '/images/group_pictures/' + req.file.filename;
    const group = new Group(groupData);
    await group.save();
    await group.populate('members', 'username profile_picture');
    return res.json({ success: true, message: 'Group created successfully', group });
  } catch (error) {
    console.error('Error creating group:', error);
    return res.status(500).json({ success: false, message: 'Error creating group.' });
  }
});

// ----------- GET GROUPS -----------
router.get('/', authenticateToken, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('members', 'username profile_picture')
      .populate('creator', 'username profile_picture')
      .sort({ createdAt: -1 });
    return res.json({ success: true, groups });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching groups.' });
  }
});

// ----------- GET GROUP DETAILS -----------
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (group) {
      res.json({ group });
    } else {
      res.status(404).json({ message: 'Group not found.' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving group.' });
  }
});

// ----------- UPDATE GROUP (NAME, DESC, IMAGE, MEMBERS) -----------
router.post('/:id/update', authenticateToken, groupUpload.single('groupImage'), async (req, res) => {
  try {
    const { name, description, members } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
    if (group.creator.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Only the creator can update.' });

    group.name = name || group.name;
    group.description = description || group.description;
    if (req.file) {
      if (group.group_picture) {
        const filePath = path.join(__dirname, '..', 'public', group.group_picture);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      group.group_picture = '/images/group_pictures/' + req.file.filename;
    }
    if (members) {
      let newMembers = Array.isArray(members) ? members : [members];
      if (!newMembers.includes(group.creator.toString())) newMembers.push(group.creator.toString());
      group.members = newMembers;
    }
    await group.save();
    res.json({ success: true, group });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating group.' });
  }
});

// ----------- DELETE GROUP -----------
router.post('/:id/delete', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
    if (group.creator.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Only creator can delete.' });

    // Remove group image
    if (group.group_picture) {
      const filePath = path.join(__dirname, '..', 'public', group.group_picture);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await Group.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting group.' });
  }
});

// ----------- ADD MEMBER -----------
router.post('/:id/add-member', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
    if (group.creator.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Only creator can add.' });

    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required.' });
    if (!group.members.map(String).includes(userId)) group.members.push(userId);

    await group.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error adding member.' });
  }
});

// ----------- REMOVE MEMBER -----------
router.post('/:id/remove-member', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
    if (group.creator.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Only creator can remove.' });

    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required.' });
    if (group.creator.toString() === userId)
      return res.status(400).json({ success: false, message: 'Cannot remove group creator.' });

    group.members = group.members.filter(id => id.toString() !== userId);
    await group.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error removing member.' });
  }
});

// ----------- LEAVE GROUP -----------
router.post('/:id/leave', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
    if (group.creator.toString() === req.user._id.toString())
      return res.status(400).json({ success: false, message: 'Creator cannot leave. Delete group instead.' });

    group.members = group.members.filter(id => id.toString() !== req.user._id.toString());
    await group.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error leaving group.' });
  }
});

// ----------- GET GROUP MESSAGES -----------
router.get('/:groupId/messages', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate('messages.sender', 'username profile_picture');
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!group.members.map(String).includes(req.user._id.toString()))
      return res.status(403).json({ success: false, message: 'You are not a member of this group' });
    return res.json({ success: true, messages: group.messages });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching messages.' });
  }
});

// ----------- ADD GROUP MESSAGE -----------
router.post('/:groupId/messages', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'Message content is required' });
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!group.members.map(String).includes(req.user._id.toString()))
      return res.status(403).json({ success: false, message: 'You are not a member of this group' });

    group.messages.push({ sender: req.user._id, content });
    await group.save();
    const newMessage = group.messages[group.messages.length - 1];
    await Group.populate(newMessage, { path: 'sender', select: 'username profile_picture' });

    req.app.get('io').to(`group:${req.params.groupId}`).emit('group_message', {
      groupId: req.params.groupId,
      message: newMessage
    });

    res.json({ success: true, message: newMessage });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding message.' });
  }
});

module.exports = router;
