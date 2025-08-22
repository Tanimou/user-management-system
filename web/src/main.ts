import naive from 'naive-ui';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';

import App from './App.vue';
import { useAuthStore } from './stores/auth';
import Dashboard from './views/Dashboard.vue';
import Login from './views/Login.vue';

// Define routes
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresGuest: true },
  },
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/users',
    name: 'Users',
    component: Dashboard,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  // Demo routes without auth for testing
  {
    path: '/demo-user',
    name: 'DemoUser',
    component: Dashboard,
    meta: { demo: 'user' },
  },
  {
    path: '/demo-admin',
    name: 'DemoAdmin',
    component: Dashboard,
    meta: { demo: 'admin' },
  },
  // Redirect /dashboard to /
  {
    path: '/dashboard',
    redirect: '/',
  },
];

// Create router
const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Create app instance
const app = createApp(App);
const pinia = createPinia();

// Use plugins
app.use(pinia);
app.use(router);
app.use(naive);

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  console.log('Router guard:', {
    to: to.path,
    from: from.path,
    isAuthenticated: authStore.isAuthenticated,
    user: authStore.user,
    meta: to.meta,
  });

  // Temporarily disable auth checks for demo - comment out for production
  if (to.path.startsWith('/demo-')) {
    next();
    return;
  }

  // Check if auth is required
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    console.log('Redirecting to login - auth required but not authenticated');
    next('/login');
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    console.log('Redirecting to dashboard - guest required but authenticated');
    next('/');
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    console.log('Redirecting to dashboard - admin required but not admin');
    // Redirect non-admin users trying to access admin routes
    next('/');
  } else {
    console.log('Navigation allowed');
    next();
  }
});

// Initialize auth store and mount app
const authStore = useAuthStore();
authStore.initialize().finally(() => {
  app.mount('#app');
});
