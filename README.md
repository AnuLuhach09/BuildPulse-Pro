# 🚀 BuildPulse Pro

**BuildPulse Pro** is a full-stack CI/CD monitoring and deployment analytics platform that helps development teams monitor build pipelines, track deployment health, analyze repository activity, and receive real-time updates through an interactive dashboard.

Designed with modern software engineering practices, BuildPulse Pro demonstrates scalable backend architecture, secure authentication, background job processing, real-time communication, and production-ready deployment using Docker.

---

# 📖 Table of Contents

* Overview
* Features
* Tech Stack
* System Architecture
* Project Structure
* Database Design
* Authentication
* Background Workers
* Installation
* Environment Variables
* Running the Project
* API Overview
* Future Enhancements
* Screenshots
* License

---

# 🎯 Overview

Modern software teams rely heavily on CI/CD pipelines to deliver software quickly. However, monitoring multiple repositories, deployments, and pipeline executions can become difficult without centralized analytics.

BuildPulse Pro provides a unified dashboard where developers can:

* Monitor repositories
* Track pipeline executions
* Analyze deployment trends
* Receive live notifications
* Manage API keys securely
* View build success metrics
* Monitor deployment frequency
* Analyze build duration

The application follows a modular architecture that separates business logic, API routes, database operations, authentication, analytics, and background workers.

---

# ✨ Features

## Authentication

* JWT Authentication
* GitHub OAuth Login
* Secure Password Hashing
* Protected Routes
* Role-Based Authorization Ready

---

## Repository Management

* Add repositories
* View repository information
* Repository statistics
* Repository analytics

---

## Pipeline Monitoring

* Pipeline history
* Build status
* Deployment tracking
* Build duration monitoring
* Success/Failure analytics

---

## Analytics Dashboard

* Build Success Rate
* Deployment Frequency
* Build Duration Trends
* Real-time Dashboard
* Repository Insights

---

## Real-Time Updates

* Socket.IO integration
* Live pipeline updates
* Instant deployment notifications
* Live analytics refresh

---

## Background Processing

* BullMQ Job Queues
* Redis-backed Workers
* Notification Queue
* Webhook Queue
* AI Analysis Worker

---

## Security

* JWT Authentication
* API Key Management
* Rate Limiting
* Request Validation
* Centralized Error Handling

---

## DevOps

* Docker Support
* Docker Compose
* Nginx Reverse Proxy
* PostgreSQL
* Redis

---

# 🛠 Tech Stack

## Frontend

* React 18
* TypeScript
* Vite
* Tailwind CSS
* React Router
* Zustand
* Socket.IO Client

---

## Backend

* Node.js
* Express.js
* TypeScript
* Prisma ORM
* PostgreSQL
* Redis
* BullMQ
* Socket.IO
* JWT Authentication

---

## DevOps

* Docker
* Docker Compose
* Nginx

---

## Testing

* Jest

---

# 🏗 System Architecture

```text
                    +--------------------+
                    |      Browser       |
                    +---------+----------+
                              |
                              |
                     React + TypeScript
                              |
                              |
                          Nginx Proxy
                              |
                              |
                    Express REST API
                              |
        +----------+----------+-----------+
        |          |                      |
   PostgreSQL     Redis             Socket.IO
        |          |                      |
     Prisma     BullMQ Workers     Live Updates
                     |
      +--------------+--------------+
      |                             |
 Webhook Worker             Notification Worker
                     
```

---

# 📁 Project Structure

```text
BuildPulse-Pro
│
├── frontend
│   ├── src
│   ├── components
│   ├── pages
│   ├── hooks
│   ├── api
│   └── store
│
├── backend
│   ├── prisma
│   ├── src
│   │   ├── modules
│   │   ├── config
│   │   ├── queues
│   │   ├── workers
│   │   ├── socket
│   │   ├── middleware
│   │   └── utils
│
├── nginx
├── docker-compose.yml
└── README.md
```

---

# 🗄 Database

The application uses **PostgreSQL** with **Prisma ORM**.

Main entities include:

* Users
* Repositories
* Pipelines
* Analytics
* API Keys
* Notifications

Prisma handles schema management, migrations, and database access with type safety.

---

# 🔐 Authentication

Authentication is implemented using JWT.

Supported authentication methods:

* Email & Password
* GitHub OAuth

Security features include:

* Password hashing
* JWT access tokens
* Protected API routes
* Middleware-based authorization

---

# ⚙ Background Workers

Heavy tasks are processed asynchronously using BullMQ.

Current workers include:

* Webhook Worker
* Notification Worker
* AI Analysis Worker

This keeps API responses fast while long-running tasks execute in the background.

---

# 🚀 Getting Started

## Clone Repository

```bash
git clone https://github.com/AnuLuhach09/BuildPulse-Pro.git
cd BuildPulse-Pro
```

---

## Install Dependencies

```bash
npm install

cd backend
npm install

cd ../frontend
npm install
```

---

## Configure Environment Variables

Create the following files:

```text
backend/.env
frontend/.env
```

Use the provided `.env.example` files as templates.

---

## Run Using Docker

```bash
docker-compose up --build
```

---

## Run Backend

```bash
cd backend
npm run dev
```

---

## Run Frontend

```bash
cd frontend
npm run dev
```

---

# 📡 API Modules

The backend is organized into feature-based modules:

* Authentication
* Users
* Repositories
* Pipelines
* Analytics
* Admin
* API Keys
* Webhooks

Each module contains:

* Controller
* Routes
* Service
* Validation Schema

This structure improves scalability and maintainability.

---

# 📊 Key Engineering Concepts Demonstrated

* REST API Design
* Modular Architecture
* Authentication & Authorization
* Background Job Processing
* Redis Caching
* Queue Management
* WebSocket Communication
* Database Modeling
* Dockerized Deployment
* Reverse Proxy Configuration
* Input Validation
* Error Handling
* Logging
* Rate Limiting

---

# 🔮 Future Enhancements

* GitHub Actions Integration
* Prometheus Monitoring
* Grafana Dashboard
* Email Notifications
* Slack Integration
* Kubernetes Deployment
* RBAC (Role-Based Access Control)
* Multi-Organization Support
* Audit Logs
* API Documentation (Swagger/OpenAPI)

---

# 🤝 Contributing

Contributions, issues, and feature requests are welcome.

Feel free to fork the repository and submit pull requests.

---

# 📄 License

This project is licensed under the MIT License.

---

# 👨‍💻 Author

**Anu Luhach**

GitHub: https://github.com/AnuLuhach09

---

⭐ If you found this project useful, consider giving it a star on GitHub!
