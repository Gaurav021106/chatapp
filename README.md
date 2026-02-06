# AI Exam Monitor System - Intelligent Online Proctoring Solution

[![GitHub license](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v16+-green)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://www.python.org/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-orange)](https://www.tensorflow.org/)

## 📋 Overview

The **AI Exam Monitor System** is a sophisticated, real-time online proctoring solution designed to maintain academic integrity in remote examination environments. By leveraging **Artificial Intelligence**, **Computer Vision**, and **Deep Learning**, the system automatically detects suspicious behaviors, reducing the need for continuous manual invigilation while providing a scalable and secure assessment platform.

## ✨ Key Features

### 🤖 Intelligent Monitoring
- ✅ **Face Detection & Tracking** - Continuous verification of candidate presence
- ✅ **Multiple Face Detection** - Alerts when extra persons are in the frame
- ✅ **Head Pose Estimation** - Detects abnormal head movements (looking away from screen)
- ✅ **Gaze Direction Analysis** - Monitors screen focus (via facial landmarks)
- ✅ **Object Detection** - Identifies prohibited items like mobile phones and books

### 💻 System Security
- ✅ **Tab-Switch Detection** - Detects if the candidate navigates away from the exam tab
- ✅ **Real-time Violation Alerts** - Instant logging of suspicious activities
- ✅ **Browser Focus Monitoring** - Ensures the exam window remains active
- ✅ **Secure Authentication** - JWT-based candidate login

### 📊 Admin & Reporting
- ✅ **Violation Logs** - Detailed history of all flagged events with timestamps
- ✅ **Live Status Dashboard** - Real-time monitoring of all active examinees
- ✅ **Post-Exam Reports** - Comprehensive analysis of candidate behavior

## 🛠️ Technology Stack

### Frontend
- **HTML5, CSS3, JavaScript** - Core web technologies
- **React.js** - For state management and dynamic UI
- **WebRTC** - For real-time camera stream acquisition

### Backend (Python AI Engine)
- **Python 3.10** - Primary analytical engine
- **Flask / FastAPI** - Web framework for AI service
- **OpenCV** - Image processing and frame sampling
- **TensorFlow / Keras** - CNN implementation for behavior classification
- **MediaPipe** - High-performance facial landmark detection (468 landmarks)

### Data & Communication
- **WebSockets** - For low-latency, real-time data transmission
- **REST APIs** - For periodic logging and reporting
- **SQLite / MongoDB** - Scalable storage for logs and session data

## ⚙️ System Architecture & Workflow

The system follows a modular, distributed architecture:

1.  **Phase 1: Client-Side Capture**
    - Accesses webcam via browser APIs.
    - Samples frames every 500ms to optimize bandwidth.
    - Extracts frame data using a hidden HTML5 canvas.

2.  **Phase 2: Data Transmission**
    - Encodes frames into Base64/Blobs.
    - Transmits data to the Python backend via WebSockets.

3.  **Phase 3: AI Inference Engine**
    - Preprocesses frames (resizing, normalization).
    - Runs Detection Stack (Face Mesh + Object Detection).
    - Calculates violation probability ($P > 0.85$ flags high-risk events).

4.  **Phase 4: Logging & Admin Review**
    - Stores violation snapshots and metadata.
    - Provides real-time alerts to invigilators.

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v16+)
- Python (3.10+)
- MongoDB (running locally or Atlas)

### Step 1: Clone & Install Frontend
```bash
git clone https://github.com/Gaurav021106/chatapp.git
cd chatapp
npm install
```

### Step 2: Set up Python Environment
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install opencv-python tensorflow mediapipe flask flask-socketio
```

### Step 3: Environment Configuration
Create a `.env` file in the root:
```env
PORT=2000
MONGODB_URI=mongodb://localhost:27017/examMonitorDB
JWT_SECRET=your_secret_key
AI_THRESHOLD=0.85
```

### Step 4: Run Application
```bash
# Start backend (Python)
python app_ai.py

# Start frontend (Node.js)
npm run dev
```

## 📈 Results & Performance
The system has demonstrated high accuracy in:
- Detecting face absence and extra persons.
- Identifying abnormal head turns and screen focus loss.
- Flagging tab-switching events instantly.

*Note: Performance may vary based on lighting conditions and camera resolution.*

## 🔄 Future Enhancements
- [ ] **Eye-Tracking & Gaze Estimation** for pinpoint focus detection.
- [ ] **Audio Monitoring** to detect verbal communication.
- [ ] **Emotion Detection** for stress level analysis.
- [ ] **Cloud Scalability** for handling thousands of concurrent users.
- [ ] **LMS Integration** (Moodle, Canvas, etc.).

## 👨‍💻 Contributors
- **Deepanshu Joshi** (D1 - 20)
- **Anshul Bora** (D1 - 12)
- **Yuvraj Satyal** (F2 - 79)
- *Guided by:* **Ms. Harshita Sinha** (School of Computing, GEHU)

## 📄 License
Licensed under the ISC License.

---
Made with ❤️ by the Project Team at Graphic Era Hill University.
