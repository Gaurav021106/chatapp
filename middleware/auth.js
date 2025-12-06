const jwt = require('jsonwebtoken');
const User = require('../models/user');
const JWTSECRET = require('../config/jwt');

function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/');

  let decoded;
  try {
    decoded = jwt.verify(token, JWTSECRET);
  } catch (err) {
    return res.redirect('/');
  }

  User.findById(decoded.id)
    .then(user => {
      if (!user) return res.redirect('/');
      req.user = user;
      if (user && typeof user.toSafeObject === 'function') {
        try {
          req.userSafe = user.toSafeObject();
        } catch (e) {
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
