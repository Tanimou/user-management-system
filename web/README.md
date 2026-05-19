# User Management Web Application

Vue 3 SPA frontend for the user management system built with modern development tools and best practices.

## 🏗️ Tech Stack

- **Vue 3** - Progressive JavaScript framework with Composition API
- **TypeScript** - Type-safe development experience
- **Vite** - Fast build tool with hot module replacement
- **Pinia** - Modern state management for Vue
- **Vue Router** - Official routing solution for Vue.js
- **Naive UI** - Modern Vue component library
- **Axios** - HTTP client with interceptors

## 📁 Project Structure

```
src/
├── api/              # API client and HTTP utilities
├── components/       # Reusable Vue components
│   ├── common/       # Generic UI components
│   ├── forms/        # Form-specific components
│   └── layout/       # Layout components
├── composables/      # Vue 3 composition API utilities
├── pages/            # Route page components
│   ├── auth/         # Authentication pages
│   ├── users/        # User management pages
│   ├── dashboard/    # Dashboard pages
│   └── common/       # Common pages (404, etc.)
├── router/           # Vue Router configuration
├── stores/           # Pinia stores
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
├── assets/           # Static assets
├── styles/           # Global styles and theme
├── App.vue           # Root component
└── main.ts           # Application entry point
```

## 🚀 Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Type check
npm run type-check

# Format code
npm run format

# Lint code (configuration in progress)
npm run lint:check
```

## 🎯 Features

- **Authentication System** - JWT-based authentication with refresh tokens
- **User Management** - Full CRUD operations with role-based access
- **Responsive Design** - Mobile-first approach with breakpoint system
- **Type Safety** - Full TypeScript integration with strict mode
- **Code Quality** - ESLint, Prettier, and pre-commit hooks
- **State Management** - Centralized state with Pinia stores
- **Route Protection** - Navigation guards for authentication and authorization

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file for local development:

```env
VITE_API_BASE_URL=http://localhost:3001
```

### Development Server

The development server runs on `http://localhost:5173` with automatic proxy configuration for API requests.

### Build Configuration

The build process creates optimized chunks:
- Vendor chunk (Vue, Router, Pinia)
- UI chunk (Naive UI components)
- Application chunks (lazy-loaded routes)

## 🧪 Testing

```bash
# Run tests in watch mode
npm run test

# Run tests once
npm run test:run
```

## 🚦 Deployment

The application is optimized for deployment on Vercel with:
- Static file generation
- Route-based code splitting
- Optimized asset bundling
- Source maps for debugging

Build the application:

```bash
npm run build
```

The `dist/` directory contains the production-ready files.