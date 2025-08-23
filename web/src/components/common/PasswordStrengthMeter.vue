<template>
  <div v-if="password" class="password-strength-meter">
    <!-- Single line layout: strength bar with inline label -->
    <div class="strength-container">
      <div class="strength-bar">
        <div 
          class="strength-fill" 
          :class="strengthClass"
          :style="{ width: strengthPercentage + '%' }"
        ></div>
      </div>
      <div class="strength-label" :class="strengthClass">
        {{ strengthText }}
      </div>
    </div>
    
    <!-- Optional detailed requirements below -->
    <div v-if="showRequirements" class="requirements-section">
      <p class="requirements-title">Password Requirements:</p>
      <ul class="requirements-list">
        <li class="requirement-item" :class="{ met: hasMinLength }">
          <n-icon :size="14">
            <component :is="hasMinLength ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          At least 8 characters
        </li>
        <li class="requirement-item" :class="{ met: hasUppercase }">
          <n-icon :size="14">
            <component :is="hasUppercase ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          At least one uppercase letter
        </li>
        <li class="requirement-item" :class="{ met: hasLowercase }">
          <n-icon :size="14">
            <component :is="hasLowercase ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          At least one lowercase letter
        </li>
        <li class="requirement-item" :class="{ met: hasNumber }">
          <n-icon :size="14">
            <component :is="hasNumber ? CheckmarkIcon : CloseIcon" />
          </n-icon>
          At least one number
        </li>
        <li class="requirement-item" :class="{ met: hasSpecial }">
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
.password-strength-meter {
  margin-top: 8px;
}

/* Single line container: bar + label side by side */
.strength-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.strength-bar {
  flex: 1;
  height: 4px;
  background-color: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  transition: all 0.3s ease;
  border-radius: 2px;
}

/* Strength level colors */
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

/* Strength label styling */
.strength-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  min-width: 50px;
  text-align: right;
  flex-shrink: 0;
}

/* Requirements section */
.requirements-section {
  margin-top: 12px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.requirements-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  margin-top: 0;
  color: #495057;
}

.requirements-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 4px 16px;
}

.requirement-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6c757d;
  transition: color 0.2s ease;
}

.requirement-item.met {
  color: #28a745;
}

.requirement-item :deep(.n-icon) {
  flex-shrink: 0;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .strength-bar {
    background-color: #3a3a3a;
  }
  
  .requirements-section {
    background-color: #2a2a2a;
    border-color: #404040;
  }
  
  .requirements-title {
    color: #e0e0e0;
  }
  
  .requirement-item {
    color: #a0a0a0;
  }
  
  .requirement-item.met {
    color: #4caf50;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .strength-bar {
    border: 1px solid #000;
  }
  
  .strength-fill {
    border: 1px solid currentColor;
  }
  
  .requirements-section {
    border-width: 2px;
  }
}

/* Mobile responsive */
@media (max-width: 600px) {
  .strength-container {
    gap: 8px;
  }
  
  .strength-label {
    min-width: 40px;
    font-size: 11px;
  }
  
  .requirements-section {
    padding: 8px;
  }
  
  .requirements-title {
    font-size: 12px;
  }
  
  .requirements-list {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  
  .requirement-item {
    font-size: 11px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .strength-fill {
    transition: none;
  }
  
  .requirement-item {
    transition: none;
  }
}
</style>