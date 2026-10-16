# Mini Video Learning Platform 🚀

A complete Full-Stack video learning platform consisting of a Node.js REST API, a React Admin Dashboard, and a Flutter Mobile Application.

## 🔗 Live Links & Deliverables

- Backend API (Render): `https://mini-learning-platform-60iw.onrender.com`
- Admin Dashboard (Vercel): `https://mini-learning-platform-60iw.onrender.com`
- API Documentation: Included in repository as `postman_collection.json`
- Github Repo link: `https://github.com/Mearg9812/mini-learning-platform.git`

## 🏗️ Architecture & Technical Decisions

- Clean Architecture: The backend utilizes a Controller-Service pattern for separation of concerns.
- Cloudflare R2 Direct Uploads: To prevent server bottlenecks, massive video files are _never_ buffered through the Node.js server. Instead, Node generates AWS S3 Presigned URLs, allowing the React client to securely upload directly to Cloudflare R2 with progress tracking.
- Database & ORM: PostgreSQL managed via Prisma ORM for type-safe database queries and automated migrations.
- Dual-Source Playback Logic: The `activeSource` (YouTube vs Cloudflare) is stored as an Enum in the database. The Flutter app uses state management (Provider) to dynamically mount either the `chewie` MP4 player or `youtube_player_iframe` based on the API response, fulfilling the "no app update required" constraint.
- Security: RBAC (Role-Based Access Control) implemented via JWT. Super Admin routes are strictly protected by custom middleware. CORS restricted to the frontend domain.
- DevOps: CI/CD configured via GitHub Actions. Deployment strategies utilize PM2 (Process Management) and Nginx reverse proxy configurations (included in repository). Automated PostgreSQL backup script (`backup.sh`) streams dumps directly to Cloudflare R2.

## 💻 Tech Stack

- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL, Firebase Admin, AWS SDK (S3)
- Frontend: React, Vite, TailwindCSS v4, Axios, React Router
- Mobile: Flutter, Provider, Dio, Flutter Secure Storage, Firebase Cloud Messaging
- Infrastructure: Cloudflare R2, Render, Vercel, Docker

## 🚀 Local Setup Instructions

1. Database and Backend

```bash
cd backend
npm install
# Create a .env file based on .env.example
npx prisma db push
npx tsc
npm start
```

2. React Admin Dashboard

cd admin-panel
npm install
npm run dev

3. Flutter Mobile App

cd mobile_app
flutter pub get
flutter run
