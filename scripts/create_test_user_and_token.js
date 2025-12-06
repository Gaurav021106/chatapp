require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');
const jwt = require('jsonwebtoken');

(async ()=>{
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const uname = 'e2e_test_' + Date.now();
    const email = uname + '@example.com';
    const password = 'Password123!';

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ username: uname, email, password });
      await user.save();
      console.log('Created user:', uname);
    } else {
      console.log('User already exists:', uname);
    }

    const secret = process.env.JWTSECRET || 'mysecretkey';
    const token = jwt.sign({ id: user._id }, secret);
    console.log('USER_ID=' + user._id);
    console.log('TOKEN=' + token);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
