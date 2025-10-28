const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for handling file uploads
const createStorage = (destination) => {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      const dest = path.join(__dirname, '..', 'public', destination);
      // Create the directory if it doesn't exist
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      cb(null, dest);
    },
    filename: function (req, file, cb) {
      // Generate unique filename using timestamp
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });
};

// File filter for images
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    return cb(new Error('Only image files are allowed!'), false);
  }
  cb(null, true);
};

// Create multer instances for different upload types
const profileUpload = multer({
  storage: createStorage('images/profile_pictures'),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

const groupUpload = multer({
  storage: createStorage('images/group_pictures'),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

module.exports = {
  profileUpload,
  groupUpload
};
