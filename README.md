# User Management System

A comprehensive full-stack user management application built with modern technologies including Vue 3 SPA frontend, Vercel serverless Node.js backend, PostgreSQL database with Prisma ORM, featuring enterprise-grade JWT authentication, role-based access control, and advanced security measures.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18%2B-brightgreen)
![Vue](https://img.shields.io/badge/Vue-3.0-4FC08D)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6)
![Tests](https://img.shields.io/badge/tests-140%2B%20passing-success)

## 📸 Application Screenshots

### Login Interface
![Login Page](docs/screenshots/login-page.png)

*Secure authentication with email/password validation and "Remember me" functionality*

### User Dashboard
![User Dashboard](docs/screenshots/users-dashboard.png)

*Comprehensive user management with search, filtering, pagination, and role-based actions*

### User Management Modals
<div style="display: flex; gap: 10px;">
  <img src="docs/screenshots/create-user-modal.png" alt="Create User" style="width: 48%;">
  <img src="docs/screenshots/edit-user-modal.png" alt="Edit User" style="width: 48%;">
</div>

*Intuitive forms for creating and editing users with role management and validation*

### Profile Management
![Profile Page](docs/screenshots/profile-page.png)

![Profile edit](docs/screenshots/profile-edit.png)![Profile upload](docs/screenshots/profile-upload.png)
*Personal profile management with photo upload, security settings, and activity tracking*

### Confirmation Dialogs
![Delete Confirmation](docs/screenshots/delete-confirmation.png)

*Safe deletion workflow with confirmation dialogs to prevent accidental data loss*

## 🚀 Key Features

### 🔐 Authentication & Security
- **JWT Authentication** with access tokens (15 min) + refresh tokens (7 days) with automatic rotation
- **Enterprise-grade Password Security** using Argon2id hashing algorithm
- **Rate Limiting Protection** against brute force attacks (IP and email-based)
- **Security Headers** including CSP, HSTS, and comprehensive XSS protection
- **Secure Cookie Management** with httpOnly, SameSite=Strict configuration

### 👥 User Management
- **Role-based Access Control** (admin/user roles with fine-grained permissions)
- **Soft Delete System** with user recovery functionality and audit trail
- **Advanced Search & Filtering** with real-time results and multiple criteria
- **Responsive Data Tables** with sorting, pagination, and column management
- **Profile Photo Upload** with image validation and storage optimization

### 🎨 User Interface
- **Modern Vue 3 SPA** with composition API and reactive state management
- **Naive UI Component Library** for consistent and accessible design
- **Responsive Design** optimized for desktop, tablet, and mobile devices
- **Real-time Notifications** for user feedback and error handling
- **Dark/Light Theme Support** with system preference detection

### 🔧 Developer Experience
- **TypeScript First** for type safety and enhanced development experience
- **Comprehensive Testing** with 140+ tests (unit, integration, E2E)
- **Hot Module Replacement** for instant development feedback
- **Automated CI/CD Pipeline** with GitHub Actions and Vercel deployment
- **Production Monitoring** with health checks and performance metrics

## 🏗️ System Architecture

The application follows a modern, scalable architecture with clear separation of concerns:

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

### Architecture Highlights

- **Stateless Backend**: Serverless functions with JWT-based authentication
- **Single Page Application**: Vue 3 SPA with client-side routing
- **Database Layer**: PostgreSQL with Prisma ORM for type-safe queries
- **Authentication Flow**: JWT access/refresh token pattern with automatic rotation
- **API Design**: RESTful endpoints with consistent error handling and CORS

📖 **Detailed Architecture Documentation**: [Project Architecture Blueprint](docs/Project_Architecture_Blueprint.md)

## 📁 Project Structure

```
├── 📁 api/                    # Serverless Backend
│   ├── 📁 lib/               
│   │   ├── 🔧 auth.ts        # JWT & authentication utilities  
│   │   ├── 🔧 prisma.ts      # Database client singleton
│   │   ├── 🔧 middleware/    # Request/response middleware
│   │   └── 🔧 routes/        # API route handlers
│   ├── 🌐 index.ts           # Main API router and endpoints
│   ├── 🔐 login.ts           # Authentication endpoint
│   ├── 🔄 refresh.ts         # Token refresh endpoint
│   ├── 👤 me.ts              # Current user profile
│   ├── 🏥 health.ts          # Health monitoring endpoint
│   └── 🗄️ prisma/           # Database schema and migrations
├── 📁 web/                   # Vue 3 Frontend
│   ├── 📁 src/
│   │   ├── 🌐 api/           # HTTP client configuration
│   │   ├── 🧩 components/    # Reusable Vue components
│   │   ├── 📦 stores/        # Pinia state management
│   │   ├── 📄 views/         # Page components
│   │   └── 🎨 assets/        # Static assets and styles
│   ├── 🧪 e2e/              # Playwright end-to-end tests
│   └── 🔬 test/             # Component and unit tests
├── 📁 tests/                 # API Test Suite
│   ├── 🔬 unit/             # Unit tests for utilities
│   ├── 🔗 integration/       # API endpoint tests
│   └── 🏭 factories/        # Test data factories
├── 📁 docs/                  # Documentation
│   ├── 🚀 DEPLOYMENT.md      # Deployment procedures
│   ├── 🏗️ INFRASTRUCTURE_SUMMARY.md # Infrastructure guide
│   ├── 🔐 SECURITY_IMPLEMENTATION.md # Security features
│   ├── 🧪 TESTING_FRAMEWORK.md # Testing documentation
│   ├── 📊 LOGGING.md         # Logging strategy
│   └── 🔧 OPERATIONS.md      # Operations runbook
├── 📁 .github/              # CI/CD and Automation
│   ├── 🔄 workflows/        # GitHub Actions workflows
│   └── 🤖 copilot-instructions.md # AI agent instructions
├── ⚙️ vercel.json            # Vercel deployment configuration
└── 🔒 .env.example          # Environment variables template
```

## 🛠️ Technology Stack

### Backend Technologies
- **Runtime**: Node.js 18+ with TypeScript 5.0
- **Framework**: Vercel Serverless Functions
- **Database**: PostgreSQL with Prisma ORM 5.0
- **Authentication**: JWT with Argon2id password hashing
- **Security**: Rate limiting, CORS, security headers
- **Testing**: Vitest with comprehensive coverage

### Frontend Technologies  
- **Framework**: Vue 3.3+ with Composition API
- **Build Tool**: Vite 4.0 with hot module replacement
- **State Management**: Pinia with TypeScript support
- **UI Library**: Naive UI with responsive design
- **Routing**: Vue Router 4 with route guards
- **HTTP Client**: Axios with request/response interceptors
- **Testing**: Vitest + Vue Test Utils + Playwright

### Development & Operations
- **Languages**: TypeScript, JavaScript, SQL
- **Version Control**: Git with conventional commits
- **CI/CD**: GitHub Actions with automated testing
- **Deployment**: Vercel with preview deployments
- **Monitoring**: Health endpoints and logging
- **Documentation**: Markdown with automated generation

📖 **Complete Technology Documentation**: [Infrastructure Summary](docs/INFRASTRUCTURE_SUMMARY.md)
## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 13+ database
- **npm** or **yarn** package manager
- **Git** for version control

### Quick Setup (5 minutes)

1. **Clone and Install Dependencies**

```bash
# Clone the repository
git clone <repository-url>
cd user-management-system

# Install all dependencies
npm install

# Or install workspace dependencies separately
npm install --workspace=api
npm install --workspace=web
```

2. **Database Configuration**

```bash
# Copy environment template
cp api/.env.example api/.env
```

Update `api/.env` with your database credentials:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/user_management"
JWT_ACCESS_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
FRONTEND_ORIGIN="http://localhost:5173"
```

3. **Database Setup and Migrations**

```bash
# Generate Prisma client and run migrations
cd api
npx prisma generate
npx prisma db push

# Seed the database with initial data (optional)
npx tsx scripts/seed.ts
```

4. **Start Development Servers**

Choose one of the following options:

**Option A: Full-stack development (recommended)**

```bash
# Start both API and frontend concurrently
npm run dev
```

**Option B: Separate terminals**

```bash
# Terminal 1: Start API server
npm run dev:api

# Terminal 2: Start frontend server  
npm run dev:frontend
```

5. **Access the Application**

- **Frontend**: <http://localhost:5173>
- **API**: <http://localhost:3000>
- **Health Check**: <http://localhost:3000/api/health>

### Default Login Credentials

```
Email: admin@example.com
Password: AdminSecure2024!@#
```

📖 **Complete Setup Guide**: [Deployment Documentation](docs/DEPLOYMENT.md)

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# API tests only
npm run test:api

# Frontend tests only  
npm run test:web

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

### Test Structure

- **140+ Tests** covering all functionality
- **Unit Tests**: Utilities, middleware, components
- **Integration Tests**: API endpoints, database operations
- **End-to-End Tests**: Complete user workflows with Playwright
- **Coverage Reports**: Comprehensive code coverage analysis

📖 **Testing Documentation**: [Testing Framework](TESTING_FRAMEWORK.md)

## 🔐 Security Features

### Authentication & Authorization
- **JWT Token System** with access/refresh token rotation
- **Argon2id Password Hashing** with secure parameters
- **Role-Based Access Control** (RBAC) with admin/user roles
- **Rate Limiting** protection against brute force attacks
- **Security Headers** including CSP, HSTS, XSS protection

### Data Protection
- **Soft Delete System** prevents data loss
- **Input Validation** with comprehensive sanitization
- **SQL Injection Protection** via Prisma ORM
- **CORS Configuration** restricted to frontend origin
- **Secure Cookie Management** with httpOnly and SameSite flags

� **Security Documentation**: [Security Implementation](SECURITY_IMPLEMENTATION.md)

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Connect Repository to Vercel**
2. **Configure Environment Variables** in Vercel dashboard
3. **Deploy automatically** on git push

```bash
# Deploy manually
npx vercel --prod
```

### Environment Variables

Required for production deployment:

```env
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
JWT_ACCESS_SECRET="production-secret-key"
JWT_REFRESH_SECRET="production-refresh-secret"
FRONTEND_ORIGIN="https://yourdomain.com"
```

📖 **Deployment Guide**: [Complete Deployment Documentation](docs/DEPLOYMENT.md)

## 📖 Documentation

### Core Documentation
- 🏗️ **[Project Architecture Blueprint](docs/Project_Architecture_Blueprint.md)** - Complete system architecture and design patterns
- 🚀 **[Deployment Guide](docs/DEPLOYMENT.md)** - Step-by-step deployment procedures
- 🏗️ **[Infrastructure Summary](docs/INFRASTRUCTURE_SUMMARY.md)** - Complete infrastructure setup and configuration
- 🔐 **[Security Implementation](SECURITY_IMPLEMENTATION.md)** - Authentication, authorization, and security features
- 🧪 **[Testing Framework](TESTING_FRAMEWORK.md)** - Comprehensive testing documentation

### Operations & Maintenance
- 🔧 **[Operations Runbook](docs/OPERATIONS.md)** - Production operations and troubleshooting
- 📊 **[Logging Strategy](docs/LOGGING.md)** - Logging implementation and monitoring
- 📋 **[API Documentation](docs/api/)** - Complete API reference and examples

### Development Guides
- 🛠️ **[Development Setup](docs/DEVELOPMENT.md)** - Local development environment setup
- 🎨 **[UI Component Guide](docs/components/)** - Frontend component documentation
- 📦 **[Database Schema](api/prisma/schema.prisma)** - Complete database schema definition

## 🤝 Contributing

We welcome contributions to the User Management System! Here's how to get started:

### Development Workflow

1. **Fork the Repository**
2. **Create a Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Follow Coding Standards**: Use TypeScript, ESLint, and Prettier
4. **Write Tests**: Ensure new features have adequate test coverage
5. **Run Tests**: `npm test` before committing
6. **Commit Changes**: Use conventional commit format
7. **Submit Pull Request**: Include clear description of changes

### Code Standards

- **TypeScript First**: All new code should be TypeScript
- **Component Structure**: Follow Vue 3 composition API patterns
- **API Design**: RESTful endpoints with consistent error handling
- **Testing**: Write unit, integration, and E2E tests for new features
- **Documentation**: Update relevant documentation for changes

📖 **Contributing Guide**: [Development Guidelines](docs/CONTRIBUTING.md)

## 📊 Project Status

### Current Version: 1.0.0

### Features Status
- ✅ **Authentication System** - Complete with JWT tokens
- ✅ **User Management** - CRUD operations with role-based access
- ✅ **Security Features** - Rate limiting, security headers, input validation
- ✅ **Testing Framework** - 140+ tests with comprehensive coverage
- ✅ **Documentation** - Complete documentation suite
- ✅ **CI/CD Pipeline** - Automated testing and deployment
- ✅ **Production Ready** - Monitoring, logging, and error handling

### Roadmap
- 🔄 **Multi-factor Authentication** - Enhanced security options
- 🔄 **Advanced User Roles** - Custom role creation and management
- 🔄 **Audit Logging** - Comprehensive activity tracking
- 🔄 **API Rate Limiting Dashboard** - Real-time monitoring interface
- 🔄 **Mobile App** - React Native companion app

## 📈 Performance & Monitoring

### Health Monitoring
- **Health Endpoint**: `/api/health` - System status and metrics
- **Database Monitoring**: Connection pool and query performance
- **Error Tracking**: Comprehensive error logging and alerting
- **Performance Metrics**: Response times and throughput monitoring

### Production Metrics
- **Response Time**: < 200ms average API response time
- **Uptime**: 99.9% availability target
- **Test Coverage**: 95%+ code coverage maintained
- **Security Scanning**: Automated vulnerability detection

📖 **Operations Guide**: [Monitoring and Maintenance](docs/OPERATIONS.md)

## 🛡️ License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### MIT License Summary
- ✅ Commercial use allowed
- ✅ Modification allowed
- ✅ Distribution allowed
- ✅ Private use allowed
- ❗ Must include copyright notice
- ❗ Must include license text

## 📞 Support & Contact

### Getting Help
- **Documentation**: Start with our comprehensive [documentation](docs/)
- **Issues**: Report bugs via [GitHub Issues](https://github.com/yourusername/user-management-system/issues)
- **Discussions**: Join [GitHub Discussions](https://github.com/yourusername/user-management-system/discussions) for questions
- **Security Issues**: Report to [security@yourcompany.com](mailto:security@yourcompany.com)

### Community
- **Contributors**: View all [contributors](https://github.com/yourusername/user-management-system/graphs/contributors)
- **Changelog**: See [CHANGELOG.md](CHANGELOG.md) for version history
- **Release Notes**: Check [GitHub Releases](https://github.com/yourusername/user-management-system/releases)

---

<div align="center">

**Made with ❤️ by the User Management System Team**

[⭐ Star this project](https://github.com/yourusername/user-management-system) • [🐛 Report Bug](https://github.com/yourusername/user-management-system/issues) • [💡 Request Feature](https://github.com/yourusername/user-management-system/issues)

</div>

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001 (when using Vercel dev)
- Vercel Dev Server: Uses the port specified in vercel.json or default Vercel port

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
- `GET /api/users/deactivated` - List deactivated users (admin only)
- `POST /api/users/{id}` - Restore deactivated user (admin only, with `action: 'restore'`)

### Profile
- `GET /api/me` - Get current user profile
- `PUT /api/me` - Update own profile (name, password)

### System Monitoring
- `GET /health` - System health check and diagnostics

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
- Deactivated users management (admin only)
- User recovery and restoration functionality
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
- **Security Scanning**: Automated CodeQL and dependency scanning
- **Security Headers**: Comprehensive security headers in production

## 🚀 Infrastructure & DevOps

### CI/CD Pipeline
- **Automated Testing**: 54+ tests run on every push
- **Security Scanning**: CodeQL analysis and dependency vulnerability checks
- **Performance Monitoring**: Bundle size analysis and response time tracking
- **Quality Gates**: ESLint, TypeScript compilation, and security audits

### Production Monitoring
- **Health Endpoint**: `/health` provides system status and diagnostics
- **Performance Tracking**: Response time and error rate monitoring
- **Database Monitoring**: Connection pooling and query performance
- **Automated Alerts**: Configurable thresholds for critical metrics

### Deployment Features
- **Zero-Downtime Deployment**: Automatic rollback capabilities
- **Environment Management**: Separate staging and production environments
- **Database Migrations**: Automated migration deployment
- **Security Headers**: Production-ready security configuration

### Documentation
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)**: Complete deployment procedures
- **[OPERATIONS.md](docs/OPERATIONS.md)**: Operations runbook and incident response
- **[LOGGING.md](docs/LOGGING.md)**: Logging strategy and monitoring guidelines
- **[INFRASTRUCTURE_SUMMARY.md](docs/INFRASTRUCTURE_SUMMARY.md)**: Complete infrastructure overview

## 📊 Monitoring & Health Checks

### Health Endpoint
```bash
curl https://your-domain.com/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 3600.5,
  "services": {
    "database": "connected",
    "memory": {
      "used": 45.2,
      "total": 128.0
    }
  }
}
```

### Performance Metrics
- **Response Time**: < 2 seconds target
- **Error Rate**: < 1% target
- **Database Queries**: < 500ms target
- **Uptime**: 99.9% availability target

## 🧪 Testing

### Test Credentials

After running the seed script:
- **Admin**: admin@example.com / AdminSecure2024!@#
- **User**: user@example.com / AdminSecure2024!@#

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.