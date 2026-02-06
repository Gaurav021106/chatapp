# ChatApp - AI-Powered Real-Time Chat Application

[![GitHub license](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v16+-green)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4.4+-green)](https://www.mongodb.com/)

## 📋 Overview

ChatApp is a modern, full-featured real-time chat application built with **Node.js**, **Express.js**, and **MongoDB**. It provides seamless communication with advanced features including private messaging, group chats, file sharing, and integrated AI bot assistance. Perfect for building collaborative communication platforms.

## ✨ Key Features

### Core Messaging
- ✅ **Real-time Private Messaging** - Instant message delivery with Socket.IO
- ✅ **Group Chat Functionality** - Create and manage group conversations
- ✅ **Message History** - Persistent message storage and retrieval
- ✅ **Typing Indicators** - See when users are typing
- ✅ **Message Search** - Find past conversations quickly

### User Management
- ✅ **User Authentication** - Secure login/signup with JWT
- ✅ **User Profile Management** - Customizable user profiles
- ✅ **Friend Request System** - Connect with other users
- ✅ **Online Status Indicators** - Real-time presence tracking
- ✅ **User Blocking** - Privacy control features

### Advanced Features
- ✅ **File Sharing Support** - Share documents, images, and media
- ✅ **AI Bot Integration** - Chat with an intelligent assistant
- ✅ **Responsive Design** - Mobile-friendly interface
- ✅ **Dark Mode** - Eye-friendly theme option
- ✅ **Notification System** - Real-time push notifications

## 🛠️ Technology Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Socket.IO** - Real-time bidirectional communication
- **JWT** - Authentication and authorization

### Frontend
- **EJS** - Templating engine
- **TailwindCSS** - Utility-first CSS framework
- **HTML5 & CSS3** - Markup and styling
- **JavaScript (ES6+)** - Client-side interactivity

### Additional Libraries
- **Bcryptjs** - Password hashing
- **Dotenv** - Environment variable management
- **Multer** - File upload handling
- **Cors** - Cross-origin resource sharing

## 📦 Prerequisites

Before you begin, ensure you have installed:
- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v4.4 or higher) - [Download](https://www.mongodb.com/try/download/community)
- **npm** (comes with Node.js)
- **Git** - For version control

## 🚀 Installation & Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/Gaurav021106/chatapp.git
cd chatapp
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Environment Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=2000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/chatappDB

# Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

# File Upload
MAX_FILE_SIZE=50mb
UPLOAD_PATH=./public/uploads

# AI Bot Configuration (Optional)
AI_BOT_API_KEY=your_ai_api_key_here
```

### Step 4: Start MongoDB

**For Local MongoDB:**
```bash
mongod
```

**For MongoDB Atlas (Cloud):**
Update `MONGODB_URI` in `.env` with your Atlas connection string.

### Step 5: Run the Application

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

The application will be available at: `http://localhost:2000`

## 📂 Project Structure

```
chatapp/
├── config/
│   ├── database.js          # MongoDB connection
│   └── passport.js          # Authentication config
├── middleware/
│   ├── auth.js              # JWT authentication
│   ├── upload.js            # File upload handler
│   └── errorHandler.js      # Error handling
├── models/
│   ├── User.js              # User schema
│   ├── Message.js           # Message schema
│   ├── Group.js             # Group chat schema
│   └── Bot.js               # AI bot schema
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── chat.js              # Chat routes
│   ├── groups.js            # Group routes
│   ├── users.js             # User management routes
│   └── bot.js               # AI bot routes
├── views/
│   ├── layouts/             # Layout templates
│   ├── auth/                # Authentication pages
│   │   ├── login.ejs
│   │   └── signup.ejs
│   ├── pages/               # Application pages
│   │   ├── dashboard.ejs
│   │   ├── chat.ejs
│   │   ├── profile.ejs
│   │   └── groups.ejs
│   └── partials/            # Reusable components
├── public/
│   ├── css/                 # Stylesheets
│   ├── js/                  # Client-side scripts
│   ├── images/              # Static images
│   └── uploads/             # User uploads
├── scripts/
│   └── seed.js              # Database seeding
├── app.js                   # Express app setup
├── server.js                # Server entry point
├── package.json             # Dependencies
├── .env.example             # Environment variables template
└── README.md                # Documentation
```

## 🔐 Authentication

The application uses **JWT (JSON Web Tokens)** for secure authentication:

1. User registers/logs in with credentials
2. Server validates and issues JWT token
3. Token stored in secure HTTP-only cookie
4. Token required for protected routes
5. Token auto-refreshed on expiry

## 🚀 Deployment

### Deploy to Render

1. Push code to GitHub
2. Connect repository to [Render](https://render.com/)
3. Set environment variables in Render dashboard
4. Deploy automatically on push

### Deploy to Heroku

```bash
# Install Heroku CLI
heroku login
heroku create your-app-name
git push heroku main
heroku config:set PORT=2000
```

### Deploy to DigitalOcean

1. Create Droplet (Ubuntu 20.04)
2. Install Node.js and MongoDB
3. Clone repository
4. Set up environment variables
5. Use PM2 for process management
6. Configure Nginx as reverse proxy

## 📚 API Documentation

### Authentication Endpoints

```
POST   /api/auth/signup      - Register new user
POST   /api/auth/login       - User login
POST   /api/auth/logout      - User logout
GET    /api/auth/me          - Get current user
POST   /api/auth/refresh     - Refresh token
```

### Chat Endpoints

```
GET    /api/chat/messages    - Get chat history
POST   /api/chat/send        - Send message
GET    /api/chat/conversations - Get all chats
DELETE /api/chat/:id         - Delete message
```

### Group Endpoints

```
GET    /api/groups           - Get user groups
POST   /api/groups           - Create group
PUT    /api/groups/:id       - Update group
DELETE /api/groups/:id       - Delete group
```

## 🤖 AI Bot Integration

ChatApp includes an integrated AI bot that:
- Answers user questions
- Provides chat suggestions
- Assists with content moderation
- Learns from conversations

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint
```

## 🐛 Known Issues & Limitations

- Maximum file upload size: 50MB
- Typing indicator works within 100m radius
- Group chats support up to 500 members
- Message history retention: 1 year

## 🔄 Future Enhancements

- [ ] Video/Audio calling capability
- [ ] End-to-end encryption
- [ ] Message reactions and emojis
- [ ] Channel/room system
- [ ] Message threading
- [ ] Advanced search with filters
- [ ] Mobile app (React Native)
- [ ] Voice messages
- [ ] Screen sharing
- [ ] Integration with third-party services

## 📝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📋 Code Standards

- Use ES6+ syntax
- Follow ESLint configuration
- Add comments for complex logic
- Write meaningful commit messages
- Test new features before submitting PR

## 📄 License

This project is licensed under the **ISC License** - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Gaurav Saklani** ([@Gaurav021106](https://github.com/Gaurav021106))

- 🔗 [GitHub Profile](https://github.com/Gaurav021106)
- 💼 [LinkedIn](https://linkedin.com/in/gaurav-saklani)

## 🙏 Acknowledgments

- Socket.IO for real-time communication
- MongoDB for reliable data storage
- Express.js community for excellent documentation
- Contributors and users for feedback

## 📞 Support & Contact

- 📧 Email: support@chatapp.com
- 🐛 [Report Issues](https://github.com/Gaurav021106/chatapp/issues)
- 💬 [Discussions](https://github.com/Gaurav021106/chatapp/discussions)
- 📖 [Documentation Wiki](https://github.com/Gaurav021106/chatapp/wiki)

## 📊 Project Stats

- **Stars:** ⭐ Growing
- **Active Development:** ✅ Yes
- **Last Updated:** February 2026
- **Node.js Version:** v16+
- **Status:** Production Ready

---

<div align="center">

**[⬆ back to top](#chatapp---ai-powered-real-time-chat-application)**

Made with ❤️ by Gaurav Saklani

</div>
