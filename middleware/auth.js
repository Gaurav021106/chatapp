const jwt = require('jsonwebtoken');
const User = require('../models/user');

const authenticateToken = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        
        // If no token exists, send them back to login immediately
        if (!token) {
            return res.redirect('/login');
        }

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWTSECRET);
        const user = await User.findById(decoded.id);

        // If token is valid but user was deleted from database
        if (!user) {
            res.clearCookie('token');
            return res.redirect('/login');
        }

        req.user = user;
        next();
    } catch (error) {
        // If token is expired or tampered with
        res.clearCookie('token');
        return res.redirect('/login');
    }
};

module.exports = authenticateToken;