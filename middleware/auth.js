const jwt = require('jsonwebtoken');
const User = require('../models/user');

function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWTSECRET);
  } catch (err) {
    return res.redirect('/');
  }

  User.findById(decoded.id)
    .then(user => {
      if (!user) return res.redirect('/');
      req.user = user;
      // Attach a safe plain object without sensitive fields for templates/APIs
      if (user && typeof user.toSafeObject === 'function') {
        try {
          req.userSafe = user.toSafeObject();
        } catch (e) {
          // Fallback: shallow copy and remove password
          const u = user.toObject ? user.toObject() : { ...user };
          delete u.password;
          req.userSafe = u;
        }
      } else {
        const u = user && user.toObject ? user.toObject() : user;
        if (u && u.password) delete u.password;
        req.userSafe = u;
      }
      next();
    })
    .catch(() => res.redirect('/'));
}

module.exports = authenticateToken;
