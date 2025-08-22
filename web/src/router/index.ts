import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/auth/LoginPage.vue'),
    meta: { requiresAuth: false, layout: 'auth' }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/pages/dashboard/DashboardPage.vue'),
    meta: { requiresAuth: true, roles: ['user', 'admin'] }
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('@/pages/dashboard/DashboardPage.vue'),
    meta: { requiresAuth: true, roles: ['admin'] }
  },
  {
    path: '/users/create',
    name: 'CreateUser',
    component: () => import('@/pages/dashboard/DashboardPage.vue'),
    meta: { requiresAuth: true, roles: ['admin'] }
  },
  {
    path: '/users/:id/edit',
    name: 'EditUser',
    component: () => import('@/pages/dashboard/DashboardPage.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
    props: true
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/pages/dashboard/DashboardPage.vue'),
    meta: { requiresAuth: true, roles: ['user', 'admin'] }
  },
  // Demo routes without auth for testing
  {
    path: '/demo-user',
    name: 'DemoUser',
    component: () => import('@/pages/dashboard/DashboardPage.vue'),
    meta: { demo: 'user' }
  },
  {
    path: '/demo-admin',
    name: 'DemoAdmin',
    component: () => import('@/pages/dashboard/DashboardPage.vue'),
    meta: { demo: 'admin' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/pages/common/NotFoundPage.vue')
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

  const requiresAuth = to.meta.requiresAuth !== false;
  const requiredRoles = to.meta.roles as string[] | undefined;

  // Handle demo routes
  if (to.meta.demo) {
    next();
    return;
  }

  if (requiresAuth && !authStore.isAuthenticated) {
    // Redirect to login if authentication required
    next({ name: 'Login', query: { redirect: to.fullPath } });
    return;
  }

  if (authStore.isAuthenticated && to.name === 'Login') {
    // Redirect authenticated users away from login page
    next({ name: 'Dashboard' });
    return;
  }

  if (requiredRoles && authStore.user) {
    const hasRequiredRole = requiredRoles.some(role => 
      authStore.user!.roles.includes(role)
    );
    
    if (!hasRequiredRole) {
      // User doesn't have required role
      next({ name: 'Dashboard' });
      return;
    }
  }

  next();
});

export default router;