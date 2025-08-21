# User Management System

A full-stack user management application built with Vue 3 SPA frontend and Vercel serverless Node.js backend, featuring JWT authentication, role-based access control, and PostgreSQL database.

## 🚀 Features

- **JWT Authentication** with access tokens (15 min) + refresh tokens (7 days) with rotation
- **Role-based Access Control** (admin/user roles)
- **Soft Delete System** preventing data loss
- **Advanced Search & Filtering** with pagination
- **Responsive UI** built with Vue 3 + Naive UI
- **Secure Backend** with argon2id password hashing
- **Real-time Token Refresh** with automatic retry on 401 errors

## 🏗️ Architecture

```
┌─────────────────┐    HTTP/JSON     ┌─────────────────┐
│                 │ ────────────────▶ │                 │
│  Vue 3 SPA      │                  │  Serverless     │
│  + Naive UI     │ ◀──────────────── │  Functions      │
│  + Pinia        │     + CORS       │  + Prisma ORM   │
└─────────────────┘                  └─────────────────┘
                                               │
                                               ▼
                                     ┌─────────────────┐
                                     │   PostgreSQL    │
                                     │    Database     │
                                     └─────────────────┘
```

## 📁 Project Structure

```
├── api/                    # Serverless backend
│   ├── lib/
│   │   ├── auth.ts        # JWT & authentication utilities
│   │   └── prisma.ts      # Database client singleton
│   ├── users/
│   │   ├── index.ts       # List/create users
│   │   └── [id].ts        # Get/update/delete user
│   ├── login.ts           # Authentication endpoint
│   ├── refresh.ts         # Token refresh endpoint
│   └── me.ts              # Current user profile
├── web/                   # Vue 3 frontend
│   ├── src/
│   │   ├── api/           # HTTP client
│   │   ├── components/    # Reusable components
│   │   ├── stores/        # Pinia state management
│   │   └── views/         # Page components
│   └── ...
└── vercel.json            # Vercel deployment config
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### 1. Install Dependencies

```bash
# Install all dependencies
npm install

# Or install workspace dependencies separately
npm install --workspace=api
npm install --workspace=web
```

### 2. Database Setup

1. Create a PostgreSQL database
2. Copy environment file and configure database:

```bash
cp api/.env.example api/.env
```

3. Update `api/.env` with your database URL:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/user_management"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
FRONTEND_URL="http://localhost:3000"
```

4. Generate Prisma client and run migrations:

```bash
npm run db:generate --workspace=api
npm run db:push --workspace=api
```

### 3. Seed Database (Optional)

Create an admin user for testing:

```bash
node api/scripts/seed.js
```

### 4. Development

Start both frontend and backend:

```bash
# Terminal 1: Start backend (API)
npm run dev --workspace=api

# Terminal 2: Start frontend
npm run dev --workspace=web
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### 5. Production Deployment

Deploy to Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## 🔐 API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/refresh` - Refresh access token

### User Management
- `GET /api/users` - List users (with search, pagination, filters)
- `POST /api/users` - Create user (admin only)
- `GET /api/users/{id}` - Get user by ID
- `PUT /api/users/{id}` - Update user (admin or self)
- `DELETE /api/users/{id}` - Soft delete user (admin only)

### Profile
- `GET /api/me` - Get current user profile
- `PUT /api/me` - Update own profile (name, password)

## 🎨 Frontend Features

### Login Page
- Email/password authentication
- Form validation
- Error handling
- Responsive design

### Dashboard
- User table with sorting and pagination
- Advanced search (name, email)
- Status filtering (active/inactive)
- Create/Edit user modals (admin only)
- Soft delete functionality (admin only)
- Profile management

## 🔒 Security Features

- **Password Security**: Argon2id hashing with salt
- **JWT Tokens**: Short-lived access tokens + httpOnly refresh cookies
- **CORS Protection**: Restricted to frontend origin
- **Input Validation**: Server-side validation on all endpoints
- **Business Rules**: Prevents self-demotion and self-deactivation
- **Soft Delete**: Prevents permanent data loss

## 🧪 Testing

### Test Credentials

After running the seed script:
- **Admin**: admin@example.com / password123
- **User**: user@example.com / password123

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.