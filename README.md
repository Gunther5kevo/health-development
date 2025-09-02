Health Development App 🏥

A full-stack health and wellness platform built with:

Backend: Flask (Python, deployed on Render)

Frontend: Vanilla JavaScript + HTML/CSS (deployed on Netlify)

Database: (e.g., PostgreSQL or SQLite — update if needed)

The app provides authentication, training modules, symptom checker, and community features.

🚀 Live Demo

Frontend: health-development.netlify.app

Backend API: health-development.onrender.com/api

📂 Project Structure
health-development/
│
├── backend/                # Flask API
│   ├── app.py              # Main Flask application
│   ├── models.py           # Database models
│   ├── routes/             # Auth, training, profiles, etc.
│   └── requirements.txt    # Python dependencies
│
├── frontend/               # Netlify-deployed frontend
│   ├── index.html
│   ├── css/
│   ├── js/
│   │   ├── config.js       # API base URL setup
│   │   └── script.js       # Core functionality
│   └── assets/
│
└── README.md

⚙️ Setup Instructions
1. Backend (Flask)
# Clone the repo
git clone https://github.com/yourusername/health-development.git
cd health-development/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate   # On Mac/Linux
venv\Scripts\activate      # On Windows

# Install dependencies
pip install -r requirements.txt

# Run locally
flask run


By default, backend runs at:

http://127.0.0.1:5000/api

2. Frontend (Vanilla JS + Netlify)

No build process required. Just open frontend/index.html locally or deploy via Netlify.

The API base is managed automatically in config.js:

const getApiBase = () => {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return "https://health-development.onrender.com/api";  // Production
  }
  return "http://127.0.0.1:5000/api";  // Local dev
};

🔑 API Endpoints
Auth

POST /api/auth/register → Register new user

POST /api/auth/login → Login and get JWT token

Profiles

GET /api/profile/<id> → Get profile details

PUT /api/profile/<id> → Update profile

Training

GET /api/training → List training modules

GET /api/training/<id> → Get specific training module



🌍 Deployment

Backend: Hosted on Render

Frontend: Hosted on Netlify

📌 Notes

Ensure your backend CORS is configured for your Netlify domain.

Always prepend /api in frontend API calls.

Environment variables (like SECRET_KEY, DB URL) should be managed securely in .env (not committed).

👨‍💻 Author

Developed by [Kevin Kipyego]