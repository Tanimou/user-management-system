<template>
  <div v-if="password" class="password-strength">
    <div class="strength-bar">
      <div 
        class="strength-fill" 
        :class="strengthClass"
        :style="{ width: strengthPercentage + '%' }"
      ></div>
    </div>
    <div class="strength-info">
      <span class="strength-label" :class="strengthClass">
        {{ strengthText }}
      </span>
    </div>
    <div class="requirements" v-if="showRequirements">
      <p class="requirements-title">Password Requirements:</p>
      <ul class="requirements-list">
        <li :class="{ met: hasMinLength }">
          <n-icon :size="14">
            <component :is="hasMinLength ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          At least 8 characters
        </li>
        <li :class="{ met: hasUppercase }">
          <n-icon :size="14">
            <component :is="hasUppercase ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          At least one uppercase letter
        </li>
        <li :class="{ met: hasLowercase }">
          <n-icon :size="14">
            <component :is="hasLowercase ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          At least one lowercase letter
        </li>
        <li :class="{ met: hasNumber }">
          <n-icon :size="14">
            <component :is="hasNumber ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          At least one number
        </li>
        <li :class="{ met: hasSpecial }">
          <n-icon :size="14">
            <component :is="hasSpecial ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          At least one special character
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CheckmarkOutline as CheckmarkIcon, CloseOutline as CloseIcon } from '@vicons/ionicons5';

interface Props {
  password: string;
  showRequirements?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showRequirements: true
});

// Password strength criteria
const hasMinLength = computed(() => props.password.length >= 8);
const hasUppercase = computed(() => /[A-Z]/.test(props.password));
const hasLowercase = computed(() => /[a-z]/.test(props.password));
const hasNumber = computed(() => /\d/.test(props.password));
const hasSpecial = computed(() => /[!@#$%^&*(),.?":{}|<>]/.test(props.password));

// Calculate strength score
const strengthScore = computed(() => {
  let score = 0;
  if (hasMinLength.value) score++;
  if (hasUppercase.value) score++;
  if (hasLowercase.value) score++;
  if (hasNumber.value) score++;
  if (hasSpecial.value) score++;
  
  // Bonus points for longer passwords
  if (props.password.length >= 12) score += 0.5;
  if (props.password.length >= 16) score += 0.5;
  
  return Math.min(score, 5);
});

// Strength percentage (0-100)
const strengthPercentage = computed(() => (strengthScore.value / 5) * 100);

// Strength classification
const strengthLevel = computed(() => {
  const score = strengthScore.value;
  if (score < 2) return 'weak';
  if (score < 3.5) return 'fair';
  if (score < 4.5) return 'good';
  return 'strong';
});

const strengthText = computed(() => {
  switch (strengthLevel.value) {
    case 'weak': return 'Weak';
    case 'fair': return 'Fair';
    case 'good': return 'Good';
    case 'strong': return 'Strong';
    default: return 'Weak';
  }
});

const strengthClass = computed(() => `strength-${strengthLevel.value}`);
</script>

<style scoped>
.password-strength {
  margin-top: 8px;
}

.strength-bar {
  height: 4px;
  background-color: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.strength-fill {
  height: 100%;
  transition: all 0.3s ease;
  border-radius: 2px;
}

.strength-weak {
  background-color: #d32f2f;
  color: #d32f2f;
}

.strength-fair {
  background-color: #f57c00;
  color: #f57c00;
}

.strength-good {
  background-color: #388e3c;
  color: #388e3c;
}

.strength-strong {
  background-color: #1976d2;
  color: #1976d2;
}

.strength-info {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.strength-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.requirements {
  margin-top: 12px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.requirements-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #495057;
}

.requirements-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.requirements-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
  font-size: 12px;
  color: #6c757d;
  transition: color 0.2s ease;
}

.requirements-list li.met {
  color: #28a745;
}

.requirements-list li :deep(.n-icon) {
  flex-shrink: 0;
}

/* Dark theme support */
.dark .requirements {
  background-color: #2a2a2a;
  border-color: #404040;
}

.dark .requirements-title {
  color: #e0e0e0;
}

.dark .requirements-list li {
  color: #a0a0a0;
}

.dark .requirements-list li.met {
  color: #4caf50;
}

/* Mobile responsive */
@media (max-width: 480px) {
  .requirements {
    padding: 8px;
  }
  
  .requirements-title {
    font-size: 12px;
  }
  
  .requirements-list li {
    font-size: 11px;
  }
}
</style>