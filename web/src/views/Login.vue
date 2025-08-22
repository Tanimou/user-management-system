<template>
  <div class="login-container">
    <n-card class="login-card" title="User Management System">
      <template #header-extra>
        <n-tag type="info">Login</n-tag>
      </template>
      
      <n-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        @submit.prevent="handleLogin"
      >
        <n-form-item label="Email" path="email">
          <n-input
            v-model:value="formData.email"
            type="email"
            placeholder="Enter your email"
            :disabled="loading"
            @keydown.enter="handleLogin"
          />
        </n-form-item>

        <n-form-item label="Password" path="password">
          <n-input
            v-model:value="formData.password"
            type="password"
            placeholder="Enter your password"
            show-password-on="mousedown"
            :disabled="loading"
            @keydown.enter="handleLogin"
          />
        </n-form-item>

        <n-form-item>
          <n-button
            type="primary"
            block
            :loading="loading"
            @click="handleLogin"
          >
            Sign In
          </n-button>
        </n-form-item>
      </n-form>

      <template #footer>
        <n-alert v-if="errorMessage" type="error" :show-icon="false">
          {{ errorMessage }}
        </n-alert>
      </template>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();

// Form data
const formData = reactive({
  email: '',
  password: '',
});

// Form validation rules
const rules = {
  email: [
    { required: true, message: 'Email is required', trigger: 'blur' },
    { type: 'email', message: 'Please enter a valid email', trigger: 'blur' }
  ],
  password: [
    { required: true, message: 'Password is required', trigger: 'blur' },
    { min: 8, message: 'Password must be at least 8 characters', trigger: 'blur' }
  ],
};

// State
const loading = ref(false);
const errorMessage = ref('');
const formRef = ref();

// Methods
async function handleLogin() {
  try {
    // Validate form
    await formRef.value?.validate();
    
    loading.value = true;
    errorMessage.value = '';

    const result = await authStore.login(formData.email, formData.password);

    if (result.success) {
      message.success('Login successful!');
      router.push('/');
    } else {
      errorMessage.value = result.message || 'Login failed';
    }
  } catch (error) {
    // Form validation failed
    console.log('Form validation failed:', error);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.login-card :deep(.n-card-header) {
  text-align: center;
  font-size: 24px;
  font-weight: 600;
}

/* Responsive Design */
@media (max-width: 768px) {
  .login-container {
    padding: 16px;
  }
  
  .login-card {
    max-width: 100%;
  }
  
  .login-card :deep(.n-card-header) {
    font-size: 20px;
  }
}

@media (max-width: 480px) {
  .login-container {
    padding: 12px;
  }
  
  .login-card :deep(.n-card-header) {
    font-size: 18px;
  }
  
  .login-card :deep(.n-card__content) {
    padding: 16px;
  }
}
</style>