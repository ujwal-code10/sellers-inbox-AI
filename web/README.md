# Seller Inbox AI - Web Frontend

A mobile-first web app for Instagram sellers to get AI reply suggestions.

## Setup

```bash
cd web
npm install
npm run dev
```

## Requirements

- Backend must be running on `http://localhost:4000`
- Node.js 18+

## Structure

```
web/
├── src/
│   ├── context/
│   │   └── AuthContext.tsx    # Auth state management
│   ├── pages/
│   │   ├── Login.tsx          # Login page
│   │   ├── Signup.tsx         # Signup page
│   │   └── Dashboard.tsx      # Protected dashboard
│   ├── services/
│   │   └── api.ts             # API client
│   ├── styles/
│   │   └── global.css         # Global styles
│   ├── App.tsx                # Routes & protection
│   └── main.tsx               # Entry point
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Features

- JWT authentication (stored in localStorage)
- Protected routes
- Auto-redirect on auth state
- Mobile-first responsive design
- Touch-friendly UI

## API Endpoints Used

- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Verify token
- `POST /api/ai/suggest-reply` - Get AI suggestions (ready for dashboard)
