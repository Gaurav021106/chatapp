const jwt = require('jsonwebtoken');
const User = require('../models/user');
const JWTSECRET = require('../config/jwt');

module.exports = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    // Check if this is an API request or page request
    if (req.accepts('application/json')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    return res.redirect('/');
  }

  try {
    const decoded = jwt.verify(token, JWTSECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      if (req.accepts('application/json')) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      return res.redirect('/');
    }
    req.user = user;
    next();
  } catch (err) {
    res.clearCookie('token');
    if (req.accepts('application/json')) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    res.redirect('/');
  }
};