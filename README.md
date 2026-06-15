# Secure File Management System

Production-ready monorepo with React frontend and Node.js/Express backend. Features JWT authentication, RBAC for management, group-based ACL for file access, and server-side file storage.

## Tech Stack

- **Frontend:** React (Vite), TailwindCSS, React Router, Axios
- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT, bcrypt, multer
- **Security:** Helmet, CORS, rate limiting, HTTP-only refresh cookies

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))

### Setup

```bash
# Install all dependencies
npm install

# Configure server environment
cp server/.env.example server/.env
# Edit server/.env with your MongoDB URI and secrets

# Start both client and server
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:5000](http://localhost:5000)

### Default Super Admin

On server start, a super admin is created from:

```
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=SuperSecure123!
```

## Project Structure

```
/client          React frontend (Vite)
/server          Express API + MongoDB
  /src
    /models      User, Group, Folder, File, RefreshToken
    /middleware  auth, role, ACL
    /routes      API endpoints
    /seed        Groups, folders, super admin
  /uploads       Server-side file storage
```

## Groups & ACL


| Group       | Default folder | Permissions        |
| ----------- | -------------- | ------------------ |
| eld         | folder1        | READ, UPLOAD       |
| dispatch    | folder2        | READ, DOWNLOAD     |
| safety      | folder3        | READ, DELETE       |
| maintenance | folder4        | READ, UPLOAD, EDIT |


Admins configure permissions via **Groups** (super admin) or assign users to groups (admin).

## API Endpoints


| Method | Endpoint             | Access     |
| ------ | -------------------- | ---------- |
| POST   | /api/auth/register   | Public     |
| POST   | /api/auth/login      | Public     |
| POST   | /api/auth/refresh    | Cookie     |
| POST   | /api/auth/logout     | Auth       |
| GET    | /api/users           | Admin+     |
| GET    | /api/groups          | Admin+     |
| GET    | /api/folders         | Auth (ACL) |
| GET    | /api/files/:folderId | Auth (ACL) |
| POST   | /api/files/upload    | Auth (ACL) |


## Roles

- **SUPER_ADMIN** — Full system access
- **ADMIN** — Manage users, assign groups, configure folder permissions
- **USER** — Access files based on group ACL only

Roles do **not** control file access; groups do.