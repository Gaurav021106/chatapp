# ChatApp

A real-time chat application with features like private messaging, group chats, file sharing, and profile management.

## Features

- User Authentication (Login/Signup)
- Real-time Private Messaging
- Group Chat Functionality
- File Sharing Support
- User Profile Management
- Friend Request System
- Online Status Indicators
- Message History
- Responsive Design

## Technologies Used

- Node.js
- Express.js
- MongoDB
- Socket.IO
- EJS Templates
- TailwindCSS
- JWT Authentication

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/Gaurav021106/chatapp.git
   cd chatapp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=2000
   MONGODB_URI=mongodb://localhost:27017/userDB
   JWT_SECRET=your-secret-key-here
   NODE_ENV=production
   ```

4. Start MongoDB service on your machine

5. Run the application:
   - For development:
     ```bash
     npm run dev
     ```
   - For production:
     ```bash
     npm start
     ```

6. Access the application at `http://localhost:2000`

## Deployment

To deploy this application:

1. Set up a MongoDB database (e.g., MongoDB Atlas)
2. Update the MONGODB_URI in .env with your database connection string
3. Set a strong JWT_SECRET
4. Deploy to your hosting platform (e.g., Heroku, Digital Ocean)

## Project Structure

```
chatapp/
├── middleware/
│   ├── auth.js
│   ├── upload.js
│   └── chatUpload.js
├── models/
│   ├── user.js
│   ├── message.js
│   └── group.js
├── public/
│   ├── images/
│   └── uploads/
├── routes/
│   ├── chat.js
│   └── groups.js
├── views/
│   ├── auth/
│   └── pages/
├── app.js
├── package.json
└── README.md
```

## License

ISC

## Author

Gaurav021106