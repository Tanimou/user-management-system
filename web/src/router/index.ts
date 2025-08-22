import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  // Demo routes without auth for testing
  {
    path: '/demo-user',
    name: 'DemoUser',
    component: () => import('@/views/Dashboard.vue'),
    meta: { demo: 'user' }
  },
  {
    path: '/demo-admin',
    name: 'DemoAdmin',
    component: () => import('@/views/Dashboard.vue'),
    meta: { demo: 'admin' }
  },
  // Redirect /dashboard to /
  {
    path: '/dashboard',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    return { top: 0 };
  }
});

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Try to restore auth state from localStorage
  if (!authStore.isAuthenticated && (localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken'))) {
    await authStore.initialize();
  }

  console.log('Router guard:', {
    to: to.path,
    from: from.path,
    isAuthenticated: authStore.isAuthenticated,
    user: authStore.user,
    meta: to.meta
  });

  // Handle demo routes
  if (to.meta.demo) {
    next();
    return;
  }

  // Check authentication requirements
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    console.log('Redirecting to login - auth required but not authenticated');
    next({ name: 'Login' });
    return;
  }

  if (authStore.isAuthenticated && to.name === 'Login') {
    console.log('Redirecting to dashboard - already authenticated');
    next({ name: 'Dashboard' });
    return;
  }

  // Check admin requirements
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    console.log('Redirecting to dashboard - admin required but not admin');
    next({ name: 'Dashboard' });
    return;
  }

  console.log('Navigation allowed');
  next();
});

export default router;