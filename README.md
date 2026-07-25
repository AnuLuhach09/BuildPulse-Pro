# BuildPulse Pro

> Intelligent CI/CD Monitoring & Deployment Analytics Platform

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + React Query + Recharts
- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Database**: PostgreSQL (Neon in production)
- **Cache / Queue**: Redis + BullMQ (Upstash in production)
- **Real-time**: Socket.io
- **Auth**: JWT + GitHub OAuth
- **Infrastructure**: Docker + Docker Compose + Nginx

## Prerequisites

- Node.js >= 20
- Docker + Docker Compose
- A GitHub OAuth App (for GitHub login)

## Quick Start (Docker)

```bash
# 1. Clone and install root deps
npm install

# 2. Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start the full stack
npm run docker:up

# 4. Run migrations
npm run db:migrate

# 5. Seed the database
npm run db:seed
```

The app will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000/api
- **Prisma Studio**: run `npm run db:studio`

## Development (Without Docker)

```bash
# Start Postgres + Redis via Docker only
docker compose up postgres redis -d

# Start backend
npm run dev:backend

# Start frontend  
npm run dev:frontend
```

## Project Structure

```
buildpulse-pro/
├── backend/          # Express + TypeScript API
├── frontend/         # React + TypeScript + Vite
├── nginx/            # Nginx reverse proxy config
├── docker-compose.yml
└── package.json      # Monorepo root
```

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for required variables.
