import naive from 'naive-ui';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';

// Create app instance
const app = createApp(App);
const pinia = createPinia();

// Use plugins
app.use(pinia);
app.use(router);
app.use(naive);

// Initialize auth store and mount app
const authStore = useAuthStore();
authStore.initialize().finally(() => {
  app.mount('#app');
});
