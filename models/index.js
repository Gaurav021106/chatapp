// Central export point for all models
const User = require('./user');
const Message = require('./message');
const Group = require('./group');
const Conversation = require('./conversation');

module.exports = {
    User,
    Message,
    Group,
    Conversation
};