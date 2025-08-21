import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import naive from 'naive-ui';

import App from './App.vue';
import Login from './views/Login.vue';
import Dashboard from './views/Dashboard.vue';
import { useAuthStore } from './stores/auth';

// Define routes
const routes = [
  { 
    path: '/login', 
    name: 'Login', 
    component: Login,
    meta: { requiresGuest: true }
  },
  { 
    path: '/', 
    name: 'Dashboard', 
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  // Redirect /dashboard to /
  { 
    path: '/dashboard', 
    redirect: '/' 
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
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    next('/');
  } else {
    next();
  }
});

// Initialize auth store and mount app
const authStore = useAuthStore();
authStore.initialize().finally(() => {
  app.mount('#app');
});