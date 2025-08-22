<template>
  <div class="password-strength-meter" v-if="password">
    <!-- Strength Bar -->
    <div class="strength-bar-container">
      <div class="strength-bar">
        <div 
          class="strength-fill" 
          :class="strengthClass"
          :style="{ width: `${score}%` }"
        />
      </div>
      <n-text :depth="2" class="strength-text">
        {{ strengthLabel }}
      </n-text>
    </div>

    <!-- Feedback Messages -->
    <div v-if="feedback.length > 0" class="feedback-container">
      <n-text :depth="3" style="font-size: 12px">
        Suggestions:
      </n-text>
      <ul class="feedback-list">
        <li v-for="message in feedback" :key="message" class="feedback-item">
          <n-text :depth="3" style="font-size: 12px">{{ message }}</n-text>
        </li>
      </ul>
    </div>

    <!-- Password Requirements -->
    <div class="requirements-container">
      <n-text :depth="3" style="font-size: 12px; margin-bottom: 4px; display: block">
        Password Requirements:
      </n-text>
      <div class="requirements-grid">
        <div class="requirement-item" :class="{ met: meetsMinLength }">
          <n-icon :color="meetsMinLength ? '#18a058' : '#d03050'">
            <component :is="meetsMinLength ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          <n-text :depth="meetsMinLength ? 1 : 3" style="font-size: 12px">
            At least 8 characters
          </n-text>
        </div>
        <div class="requirement-item" :class="{ met: hasUppercase }">
          <n-icon :color="hasUppercase ? '#18a058' : '#d03050'">
            <component :is="hasUppercase ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          <n-text :depth="hasUppercase ? 1 : 3" style="font-size: 12px">
            Uppercase letter
          </n-text>
        </div>
        <div class="requirement-item" :class="{ met: hasLowercase }">
          <n-icon :color="hasLowercase ? '#18a058' : '#d03050'">
            <component :is="hasLowercase ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          <n-text :depth="hasLowercase ? 1 : 3" style="font-size: 12px">
            Lowercase letter
          </n-text>
        </div>
        <div class="requirement-item" :class="{ met: hasNumber }">
          <n-icon :color="hasNumber ? '#18a058' : '#d03050'">
            <component :is="hasNumber ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          <n-text :depth="hasNumber ? 1 : 3" style="font-size: 12px">
            Number
          </n-text>
        </div>
        <div class="requirement-item" :class="{ met: hasSpecialChar }">
          <n-icon :color="hasSpecialChar ? '#18a058' : '#d03050'">
            <component :is="hasSpecialChar ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          <n-text :depth="hasSpecialChar ? 1 : 3" style="font-size: 12px">
            Special character
          </n-text>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useMessage } from 'naive-ui';
import { Checkmark as CheckmarkIcon, Close as CloseIcon } from '@vicons/ionicons5';
import apiClient from '@/api/axios';

interface Props {
  password: string;
}

const props = defineProps<Props>();

const message = useMessage();
const loading = ref(false);
const score = ref(0);
const strength = ref<'weak' | 'fair' | 'good' | 'strong'>('weak');
const feedback = ref<string[]>([]);
const isValid = ref(false);

// Computed properties for requirements
const meetsMinLength = computed(() => props.password.length >= 8);
const hasUppercase = computed(() => /[A-Z]/.test(props.password));
const hasLowercase = computed(() => /[a-z]/.test(props.password));
const hasNumber = computed(() => /[0-9]/.test(props.password));
const hasSpecialChar = computed(() => /[^a-zA-Z0-9]/.test(props.password));

const strengthClass = computed(() => ({
  'strength-weak': strength.value === 'weak',
  'strength-fair': strength.value === 'fair', 
  'strength-good': strength.value === 'good',
  'strength-strong': strength.value === 'strong',
}));

const strengthLabel = computed(() => {
  const labels = {
    weak: 'Weak',
    fair: 'Fair',
    good: 'Good', 
    strong: 'Strong'
  };
  return labels[strength.value];
});

// Debounced password validation
let validationTimeout: NodeJS.Timeout;

const validatePassword = async (password: string) => {
  if (!password) {
    score.value = 0;
    strength.value = 'weak';
    feedback.value = [];
    isValid.value = false;
    return;
  }

  loading.value = true;
  try {
    const response = await apiClient.post('/validate-password', { password });
    const result = response.data;
    
    score.value = result.score;
    strength.value = result.strength;
    feedback.value = result.feedback || [];
    isValid.value = result.isValid;
  } catch (error) {
    console.error('Password validation error:', error);
    // Fallback to basic client-side validation
    score.value = calculateBasicScore(password);
    strength.value = getBasicStrength(score.value);
    feedback.value = ['Unable to validate password strength'];
    isValid.value = password.length >= 8;
  } finally {
    loading.value = false;
  }
};

// Basic client-side fallback validation
const calculateBasicScore = (password: string): number => {
  let score = 0;
  
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 10;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 20;
  
  return Math.min(100, score);
};

const getBasicStrength = (score: number): 'weak' | 'fair' | 'good' | 'strong' => {
  if (score < 40) return 'weak';
  if (score < 65) return 'fair';
  if (score < 80) return 'good';
  return 'strong';
};

const debouncedValidate = (password: string) => {
  clearTimeout(validationTimeout);
  validationTimeout = setTimeout(() => {
    validatePassword(password);
  }, 300);
};

// Watch for password changes
watch(() => props.password, debouncedValidate, { immediate: true });

// Expose validation state for parent component
defineExpose({
  isValid: computed(() => isValid.value),
  score: computed(() => score.value),
  strength: computed(() => strength.value),
});
</script>

<style scoped>
.password-strength-meter {
  margin-top: 8px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #e0e0e6;
}

.strength-bar-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.strength-bar {
  flex: 1;
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.strength-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
  border-radius: 3px;
}

.strength-fill.strength-weak {
  background-color: #d03050;
}

.strength-fill.strength-fair {
  background-color: #f0a020;
}

.strength-fill.strength-good {
  background-color: #2080f0;
}

.strength-fill.strength-strong {
  background-color: #18a058;
}

.strength-text {
  font-size: 12px;
  font-weight: 500;
  min-width: 45px;
  text-align: right;
}

.feedback-container {
  margin-bottom: 12px;
}

.feedback-list {
  margin: 4px 0 0 0;
  padding-left: 16px;
  list-style: none;
}

.feedback-item {
  position: relative;
  margin-bottom: 2px;
}

.feedback-item::before {
  content: '•';
  color: #f0a020;
  position: absolute;
  left: -12px;
}

.requirements-container {
  border-top: 1px solid #e0e0e6;
  padding-top: 8px;
}

.requirements-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  margin-top: 4px;
}

.requirement-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.requirement-item.met {
  opacity: 1;
}

.requirement-item:not(.met) {
  opacity: 0.6;
}

@media (max-width: 480px) {
  .requirements-grid {
    grid-template-columns: 1fr;
  }
  
  .strength-bar-container {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  
  .strength-text {
    text-align: left;
    min-width: auto;
  }
}
</style>