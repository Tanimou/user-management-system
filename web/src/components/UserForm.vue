<template>
  <n-form
    ref="formRef"
    :model="formData"
    :rules="rules"
    label-placement="top"
    @submit.prevent="handleSubmit"
  >
    <!-- Basic Information Section -->
    <n-divider title-placement="left">
      <n-text style="font-size: 14px; font-weight: 500;">Basic Information</n-text>
    </n-divider>

    <n-form-item label="Name" path="name">
      <n-input
        v-model:value="formData.name"
        placeholder="Enter full name"
        :maxlength="120"
        show-count
        clearable
      />
    </n-form-item>

    <n-form-item v-if="!isEditing || authStore.isAdmin" label="Email" path="email">
      <n-input
        v-model:value="formData.email"
        type="email"
        placeholder="Enter email address"
        :maxlength="180"
        show-count
        :disabled="isEditing && !authStore.isAdmin"
        clearable
      />
    </n-form-item>

    <!-- Password Section -->
    <n-divider title-placement="left">
      <n-text style="font-size: 14px; font-weight: 500;">
        {{ isEditing ? 'Change Password' : 'Password' }}
      </n-text>
    </n-divider>

    <n-form-item 
      :label="isEditing ? 'New Password' : 'Password'" 
      path="password"
    >
      <n-input-group>
        <n-input
          v-model:value="formData.password"
          :type="showPassword ? 'text' : 'password'"
          :placeholder="isEditing ? 'Leave blank to keep current password' : 'Enter password or generate one'"
          clearable
          style="flex: 1"
        />
        <n-button @click="togglePasswordVisibility" secondary>
          <template #icon>
            <n-icon><component :is="showPassword ? EyeOffIcon : EyeIcon" /></n-icon>
          </template>
        </n-button>
        <n-button 
          v-if="!isEditing || authStore.isAdmin" 
          @click="generatePassword" 
          secondary
          type="primary"
        >
          <template #icon>
            <n-icon><RefreshIcon /></n-icon>
          </template>
          Generate
        </n-button>
      </n-input-group>
    </n-form-item>

    <!-- Password Strength Meter -->
    <password-strength-meter 
      v-if="formData.password" 
      :password="formData.password"
      ref="passwordStrengthRef"
    />

    <!-- Password Confirmation -->
    <n-form-item 
      v-if="formData.password" 
      label="Confirm Password" 
      path="confirmPassword"
    >
      <n-input
        v-model:value="formData.confirmPassword"
        :type="showPassword ? 'text' : 'password'"
        placeholder="Re-enter password to confirm"
        clearable
      />
    </n-form-item>

    <!-- Admin-Only Sections -->
    <n-divider 
      v-if="authStore.isAdmin" 
      title-placement="left"
    >
      <n-text style="font-size: 14px; font-weight: 500;">Roles & Permissions</n-text>
    </n-divider>

    <n-form-item v-if="authStore.isAdmin" label="User Roles" path="roles">
      <n-checkbox-group v-model:value="formData.roles">
        <n-space>
          <n-checkbox value="user" :disabled="!formData.roles.includes('user')">
            <n-text>User</n-text>
            <n-text depth="3" style="font-size: 12px; margin-left: 4px;">
              (Basic Access - Required)
            </n-text>
          </n-checkbox>
          <n-checkbox 
            value="admin" 
            :disabled="isEditing && isSelf && formData.roles.includes('admin')"
          >
            <n-text>Administrator</n-text>
            <n-text depth="3" style="font-size: 12px; margin-left: 4px;">
              (Full System Access)
            </n-text>
            <n-text 
              v-if="isEditing && isSelf && formData.roles.includes('admin')" 
              depth="3" 
              style="font-size: 11px; color: #f0a020; margin-left: 4px;"
            >
              (Cannot remove your own admin role)
            </n-text>
          </n-checkbox>
        </n-space>
      </n-checkbox-group>
    </n-form-item>

    <n-form-item 
      v-if="authStore.isAdmin && isEditing && !isSelf" 
      label="Account Status" 
      path="isActive"
    >
      <n-space align="center">
        <n-switch
          v-model:value="formData.isActive"
          :checked-value="true"
          :unchecked-value="false"
        >
          <template #checked>Active</template>
          <template #unchecked>Inactive</template>
        </n-switch>
        <n-text :depth="formData.isActive ? 1 : 3">
          {{ formData.isActive ? 'User is active and can login' : 'User is deactivated and cannot login' }}
        </n-text>
      </n-space>
      <n-alert 
        v-if="!formData.isActive" 
        type="warning" 
        style="margin-top: 8px;"
        size="small"
      >
        Deactivating this user will immediately revoke their access to the system.
      </n-alert>
    </n-form-item>

    <div class="form-actions">
      <n-space>
        <n-button @click="handleCancel">Cancel</n-button>
        <n-button type="primary" :loading="loading" @click="handleSubmit">
          {{ isEditing ? 'Update' : 'Create' }}
        </n-button>
      </n-space>
    </div>
  </n-form>

  <!-- Role Confirmation Modal -->
  <RoleConfirmationModal
    :show="showConfirmation"
    :title="confirmationConfig.title"
    :message="confirmationConfig.message"
    :details="confirmationConfig.details"
    :role-changes="confirmationConfig.roleChanges"
    :confirmation-type="confirmationConfig.type"
    :loading="loading"
    @confirm="handleConfirmationAccept"
    @cancel="handleConfirmationCancel"
  />
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useAuthStore, type User } from '@/stores/auth';
import { useMessage } from 'naive-ui';
import { 
  Eye as EyeIcon, 
  EyeOff as EyeOffIcon, 
  Refresh as RefreshIcon 
} from '@vicons/ionicons5';
import RoleConfirmationModal from './RoleConfirmationModal.vue';
import PasswordStrengthMeter from './PasswordStrengthMeter.vue';

interface Props {
  user?: User | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  save: [userData: any];
  cancel: [];
}>();

const authStore = useAuthStore();
const message = useMessage();

// Computed
const isEditing = computed(() => !!props.user);
const isSelf = computed(() => props.user?.id === authStore.user?.id);

// Form data
const formData = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  roles: ['user'] as string[],
  isActive: true,
});

// State
const loading = ref(false);
const formRef = ref();
const showConfirmation = ref(false);
const pendingUserData = ref<any>(null);
const showPassword = ref(false);
const passwordStrengthRef = ref();

// Confirmation config
const confirmationConfig = ref({
  title: '',
  message: '',
  details: '',
  roleChanges: null as any,
  type: 'warning' as 'warning' | 'error'
});

// Enhanced form rules with better validation
const rules = computed(() => ({
  name: [
    { required: true, message: 'Name is required', trigger: 'blur' },
    { max: 120, message: 'Name cannot exceed 120 characters', trigger: 'blur' },
    { 
      validator: (rule: any, value: string) => {
        if (value && value.trim().length < 2) {
          return new Error('Name must be at least 2 characters');
        }
        return true;
      },
      trigger: 'blur'
    }
  ],
  email: !isEditing.value || authStore.isAdmin ? [
    { required: true, message: 'Email is required', trigger: 'blur' },
    { type: 'email', message: 'Please enter a valid email', trigger: 'blur' },
    { max: 180, message: 'Email cannot exceed 180 characters', trigger: 'blur' },
    {
      validator: (rule: any, value: string) => {
        if (value && !value.toLowerCase().includes('@')) {
          return new Error('Email must contain @ symbol');
        }
        return true;
      },
      trigger: 'blur'
    }
  ] : [],
  password: isEditing.value ? [
    { 
      validator: (rule: any, value: string) => {
        if (!value) return true; // Empty password is allowed for editing
        if (value.length < 8) {
          return new Error('Password must be at least 8 characters');
        }
        return true;
      },
      trigger: 'blur'
    }
  ] : [
    { required: true, message: 'Password is required', trigger: 'blur' },
    { min: 8, message: 'Password must be at least 8 characters', trigger: 'blur' }
  ],
  confirmPassword: [
    {
      validator: (rule: any, value: string) => {
        if (formData.password && value !== formData.password) {
          return new Error('Passwords do not match');
        }
        return true;
      },
      trigger: ['blur', 'input']
    }
  ],
  roles: [
    { 
      type: 'array', 
      min: 1, 
      message: 'At least one role is required', 
      trigger: 'change',
      validator: (rule: any, value: string[]) => {
        if (!value || !value.includes('user')) {
          return new Error('User role is required');
        }
        return true;
      }
    }
  ],
}));

// Password utilities
const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value;
};

const generatePassword = () => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure password has at least one of each required type
  const requiredChars = [
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ', // uppercase
    'abcdefghijklmnopqrstuvwxyz', // lowercase  
    '0123456789', // numbers
    '!@#$%^&*' // special chars
  ];
  
  // Add one character from each required set
  requiredChars.forEach(chars => {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  });
  
  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  // Shuffle the password to avoid predictable patterns
  password = password.split('').sort(() => Math.random() - 0.5).join('');
  
  formData.password = password;
  formData.confirmPassword = password;
  
  message.success('Secure password generated!');
};

// Watch for user changes
watch(() => props.user, (user) => {
  if (user) {
    formData.name = user.name;
    formData.email = user.email;
    formData.password = '';
    formData.confirmPassword = '';
    formData.roles = [...user.roles];
    formData.isActive = user.isActive;
  } else {
    // Reset form for create mode
    formData.name = '';
    formData.email = '';
    formData.password = '';
    formData.confirmPassword = '';
    formData.roles = ['user'];
    formData.isActive = true;
  }
}, { immediate: true });

// Clear confirm password when main password changes
watch(() => formData.password, (newPassword) => {
  if (!newPassword) {
    formData.confirmPassword = '';
  }
});

// Methods
async function handleSubmit() {
  try {
    await formRef.value?.validate();
    
    // Additional password strength validation for new passwords
    if (formData.password && passwordStrengthRef.value) {
      const isStrong = passwordStrengthRef.value.score >= 65;
      if (!isStrong) {
        message.warning('Please use a stronger password for better security');
        // Don't prevent submission but warn the user
      }
    }
    
    loading.value = true;
    
    const userData: any = {
      name: formData.name.trim(),
    };

    // Only include email for new users or if admin is editing
    if (!isEditing.value || authStore.isAdmin) {
      userData.email = formData.email.toLowerCase().trim();
    }

    // Only include password if provided
    if (formData.password) {
      userData.password = formData.password;
    }

    // Only include roles if admin
    if (authStore.isAdmin) {
      userData.roles = formData.roles;
      
      // Only include isActive if editing and not self
      if (isEditing.value && !isSelf.value) {
        userData.isActive = formData.isActive;
      }
    }

    // Check if role change requires confirmation
    if (isEditing.value && authStore.isAdmin && requiresRoleConfirmation()) {
      showRoleConfirmation(userData);
    } else {
      emit('save', userData);
    }
  } catch (error) {
    // Form validation failed
    message.error('Please correct the errors in the form');
    console.log('Form validation failed:', error);
  } finally {
    loading.value = false;
  }
}

function handleCancel() {
  emit('cancel');
}

// Helper functions for role confirmation
function requiresRoleConfirmation(): boolean {
  if (!props.user) return false;
  
  const oldRoles = props.user.roles;
  const newRoles = formData.roles;
  
  // Adding admin role requires confirmation
  if (!oldRoles.includes('admin') && newRoles.includes('admin')) {
    return true;
  }
  
  // Removing admin role requires confirmation
  if (oldRoles.includes('admin') && !newRoles.includes('admin')) {
    return true;
  }
  
  return false;
}

function showRoleConfirmation(userData: any) {
  const oldRoles = props.user!.roles;
  const newRoles = formData.roles;
  
  const added = newRoles.filter(role => !oldRoles.includes(role));
  const removed = oldRoles.filter(role => !newRoles.includes(role));
  
  let title = 'Confirm Role Changes';
  let message = `You are about to change the roles for ${props.user!.name}.`;
  let details = '';
  let type: 'warning' | 'error' = 'warning';
  
  if (removed.includes('admin')) {
    title = 'Remove Admin Access';
    message = `You are about to remove admin access from ${props.user!.name}.`;
    details = 'This will revoke all administrative privileges. The user will only have regular user access.';
    type = 'error';
  } else if (added.includes('admin')) {
    title = 'Grant Admin Access';
    message = `You are about to grant admin access to ${props.user!.name}.`;
    details = 'This will give the user full administrative privileges including the ability to manage other users and roles.';
    type = 'warning';
  }
  
  confirmationConfig.value = {
    title,
    message,
    details,
    roleChanges: { added, removed },
    type
  };
  
  pendingUserData.value = userData;
  showConfirmation.value = true;
}

function handleConfirmationAccept() {
  if (pendingUserData.value) {
    emit('save', pendingUserData.value);
  }
  handleConfirmationCancel();
}

function handleConfirmationCancel() {
  showConfirmation.value = false;
  pendingUserData.value = null;
  loading.value = false;
}
</script>

<style scoped>
.form-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Responsive Design */
@media (max-width: 480px) {
  .form-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .form-actions :deep(.n-button) {
    width: 100%;
  }
}
</style>