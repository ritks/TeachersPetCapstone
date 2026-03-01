# Teacher's Pet — Frontend

React 19 + Vite frontend for the Teacher's Pet math tutoring app.

## Setup

```sh
npm install
npm run dev
```

Requires the backend running on http://localhost:8000 and a `frontend/.env` file with Firebase credentials. See the root [README](../README.md) for full setup instructions.

## Key Files

```
src/
├── firebase.js                  # Firebase app, auth, Firestore exports
├── main.jsx                     # Entry point — wraps app in AuthProvider
├── App.jsx                      # All routing and page logic
├── contexts/
│   └── AuthContext.jsx          # useAuth() hook (login, register, Google, logout)
└── components/
    ├── EntryPage.jsx             # Landing page (Student / Teacher / Guest)
    ├── TeacherLoginPage.jsx      # Email+password and Google OAuth
    ├── StudentEntryPage.jsx      # Course code entry
    └── AnalyticsDashboard.jsx    # Teacher view of student chat logs
```

## Environment Variables

Create `frontend/.env`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```
