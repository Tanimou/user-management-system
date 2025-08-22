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
            ref="emailInputRef"
            v-model:value="formData.email"
            type="email"
            placeholder="Enter your email"
            :disabled="loading"
            autocomplete="email"
            aria-label="Email address"
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
            autocomplete="current-password"
            aria-label="Password"
            @keydown.enter="handleLogin"
            @input="handlePasswordInput"
          />
          <!-- Password Strength Indicator -->
          <div v-if="formData.password && passwordStrength" class="password-strength">
            <div class="strength-bar">
              <div 
                class="strength-fill" 
                :class="[`strength-${passwordStrength.strength}`]"
                :style="{ width: `${passwordStrength.score}%` }"
              ></div>
            </div>
            <div class="strength-text">
              <span :class="[`strength-${passwordStrength.strength}`]">
                {{ getStrengthText(passwordStrength.strength) }}
              </span>
            </div>
            <div v-if="passwordStrength.feedback.length" class="strength-feedback">
              <ul>
                <li v-for="tip in passwordStrength.feedback.slice(0, 2)" :key="tip">
                  {{ tip }}
                </li>
              </ul>
            </div>
          </div>
        </n-form-item>

        <!-- Remember Me and Forgot Password -->
        <n-form-item>
          <div class="form-options">
            <n-checkbox v-model:checked="formData.rememberMe" :disabled="loading">
              Remember me
            </n-checkbox>
            <n-button 
              text 
              type="primary" 
              size="small"
              @click="handleForgotPassword"
              :disabled="loading"
            >
              Forgot password?
            </n-button>
          </div>
        </n-form-item>

        <n-form-item>
          <n-button
            type="primary"
            block
            :loading="loading"
            :disabled="loading"
            @click="handleLogin"
            aria-label="Sign in to your account"
          >
            <template v-if="loading">
              <n-spin size="small" style="margin-right: 8px" />
              Signing In...
            </template>
            <template v-else>
              Sign In
            </template>
          </n-button>
        </n-form-item>
      </n-form>

      <template #footer>
        <!-- Rate Limit Warning -->
        <n-alert v-if="rateLimitInfo" type="warning" class="rate-limit-alert">
          <template #icon>
            <n-icon><shield-checkmark-outline /></n-icon>
          </template>
          {{ rateLimitInfo }}
        </n-alert>
        
        <!-- General Error Message -->
        <n-alert v-if="errorMessage && !rateLimitInfo" type="error" :show-icon="false">
          {{ errorMessage }}
        </n-alert>
      </template>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { ShieldCheckmarkOutline } from '@vicons/ionicons5';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();

// Refs
const formRef = ref();
const emailInputRef = ref();

// Form data
const formData = reactive({
  email: '',
  password: '',
  rememberMe: false,
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
const rateLimitInfo = ref('');
const passwordStrength = ref<any>(null);
const lastActivity = ref(Date.now());

// Password strength calculation (simplified client-side version)
function calculatePasswordStrength(password: string) {
  if (!password) return null;

  let score = 0;
  const feedback: string[] = [];
  
  // Length scoring
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 25;
  
  // Character variety
  if (/[a-z]/.test(password)) score += 12.5;
  if (/[A-Z]/.test(password)) score += 12.5;
  if (/[0-9]/.test(password)) score += 12.5;
  if (/[^a-zA-Z0-9]/.test(password)) score += 12.5;
  
  // Determine strength level
  let strength: 'weak' | 'fair' | 'good' | 'strong';
  if (score < 40) {
    strength = 'weak';
    feedback.push('Use a mix of letters, numbers, and symbols');
  } else if (score < 65) {
    strength = 'fair';
    feedback.push('Consider making it longer');
  } else if (score < 85) {
    strength = 'good';
    feedback.push('Good password strength');
  } else {
    strength = 'strong';
    feedback.push('Excellent password strength!');
  }
  
  if (password.length < 12) {
    feedback.push('Use 12+ characters for better security');
  }
  
  return {
    strength,
    score: Math.min(score, 100),
    feedback
  };
}

function getStrengthText(strength: string) {
  const texts = {
    weak: 'Weak',
    fair: 'Fair', 
    good: 'Good',
    strong: 'Strong'
  };
  return texts[strength as keyof typeof texts] || 'Unknown';
}

function handlePasswordInput() {
  passwordStrength.value = calculatePasswordStrength(formData.password);
}

// Handle forgot password
function handleForgotPassword() {
  message.info('Forgot password functionality will be available in a future update.');
}

// Activity tracking for auto-logout
function updateActivity() {
  lastActivity.value = Date.now();
}

function checkInactivity() {
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();
  
  if (authStore.isAuthenticated && now - lastActivity.value > INACTIVITY_TIMEOUT) {
    authStore.logout();
    message.warning('You have been logged out due to inactivity.');
    if (router.currentRoute.value.path !== '/login') {
      router.push('/login');
    }
  }
}

// Enhanced error handling
function getErrorMessage(error: any): string {
  // Handle rate limiting errors
  if (error.response?.status === 429) {
    const retryAfter = error.response.headers['retry-after'];
    const rateLimitMessage = error.response.data?.error;
    
    if (retryAfter) {
      const minutes = Math.ceil(retryAfter / 60);
      rateLimitInfo.value = `Too many login attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
      return '';
    } else {
      rateLimitInfo.value = rateLimitMessage || 'Too many login attempts. Please try again later.';
      return '';
    }
  }
  
  // Clear any existing rate limit info
  rateLimitInfo.value = '';
  
  // Handle other errors
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

// Enhanced login method
async function handleLogin() {
  try {
    // Validate form
    await formRef.value?.validate();
    
    loading.value = true;
    errorMessage.value = '';
    rateLimitInfo.value = '';
    updateActivity();

    const result = await authStore.login(formData.email, formData.password, formData.rememberMe);

    if (result.success) {
      message.success('Login successful!');
      
      // Role-based redirect
      if (authStore.isAdmin) {
        router.push('/');
      } else {
        router.push('/');
      }
    } else {
      errorMessage.value = getErrorMessage({ message: result.message });
    }
  } catch (error: any) {
    console.error('Login error:', error);
    errorMessage.value = getErrorMessage(error);
  } finally {
    loading.value = false;
  }
}

// Keyboard navigation
function handleKeyboardNavigation(event: KeyboardEvent) {
  if (event.key === 'Enter' && !loading.value) {
    handleLogin();
  }
}

// Lifecycle
onMounted(async () => {
  // Auto-focus on email field
  await nextTick();
  emailInputRef.value?.focus();
  
  // Set up activity tracking
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  events.forEach(event => {
    document.addEventListener(event, updateActivity, { passive: true });
  });
  
  // Set up inactivity check
  const inactivityTimer = setInterval(checkInactivity, 60000); // Check every minute
  
  // Set up keyboard navigation
  window.addEventListener('keydown', handleKeyboardNavigation);
  
  // Cleanup
  onUnmounted(() => {
    events.forEach(event => {
      document.removeEventListener(event, updateActivity);
    });
    clearInterval(inactivityTimer);
    window.removeEventListener('keydown', handleKeyboardNavigation);
  });
});
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
  max-width: 420px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.login-card :deep(.n-card-header) {
  text-align: center;
  font-size: 24px;
  font-weight: 600;
}

/* Form options styling */
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin: 8px 0;
}

/* Password strength indicator */
.password-strength {
  margin-top: 8px;
}

.strength-bar {
  width: 100%;
  height: 4px;
  background-color: var(--n-border-color);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}

.strength-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
  border-radius: 2px;
}

.strength-weak {
  background-color: #f56565;
  color: #f56565;
}

.strength-fair {
  background-color: #ed8936;
  color: #ed8936;
}

.strength-good {
  background-color: #38a169;
  color: #38a169;
}

.strength-strong {
  background-color: #2f855a;
  color: #2f855a;
}

.strength-text {
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
}

.strength-feedback {
  font-size: 11px;
  color: var(--n-text-color-disabled);
}

.strength-feedback ul {
  margin: 0;
  padding-left: 16px;
}

.strength-feedback li {
  margin: 2px 0;
}

/* Rate limit alert styling */
.rate-limit-alert {
  margin-bottom: 8px;
}

/* Loading button enhancements */
.login-card :deep(.n-button.n-button--loading .n-button__content) {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Focus states for accessibility */
.login-card :deep(.n-input:focus-within) {
  outline: 2px solid var(--n-primary-color);
  outline-offset: 2px;
}

.login-card :deep(.n-button:focus) {
  outline: 2px solid var(--n-primary-color);
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .strength-bar {
    border: 1px solid var(--n-border-color);
  }
  
  .strength-fill {
    border: 1px solid currentColor;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .strength-fill {
    transition: none;
  }
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
  
  .form-options {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
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
  
  .strength-feedback {
    font-size: 10px;
  }
}

/* Touch device optimizations */
@media (hover: none) and (pointer: coarse) {
  .login-card :deep(.n-button) {
    min-height: 44px;
  }
  
  .form-options .n-button {
    padding: 8px 12px;
  }
}
</style>