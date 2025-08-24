<template>
  <n-modal v-model:show="show" style="width: 90vw; max-width: 800px">
    <n-card title="Personal Profile" :bordered="false" size="huge" role="dialog" aria-modal="true">
      <template #header-extra>
        <n-button quaternary circle @click="handleCancel">
          <template #icon>
            <n-icon><CloseIcon /></n-icon>
          </template>
        </n-button>
      </template>

      <div class="profile-container">
        <!-- Profile Header Section -->
        <div class="profile-header">
          <div class="profile-avatar">
            <n-avatar 
              :size="80" 
              :src="userAvatarUrl" 
              :fallback-src="defaultAvatarUrl"
              round
            >
              <template #fallback>
                <n-icon :size="40"><PersonIcon /></n-icon>
              </template>
            </n-avatar>
            <n-button 
              size="small" 
              secondary 
              type="primary"
              @click="showAvatarUpload = true" 
              class="change-avatar-btn"
            >
              Change Photo
            </n-button>
          </div>
          
          <div class="profile-info">
            <h2>{{ authStore.user?.name }}</h2>
            <p class="email">{{ authStore.user?.email }}</p>
            <div class="role-badges">
              <n-tag 
                v-for="role in authStore.user?.roles" 
                :key="role" 
                :type="role === 'admin' ? 'success' : 'info'"
                round
              >
                {{ capitalizeRole(role) }}
              </n-tag>
            </div>
            <div class="account-meta">
              <p><strong>Member since:</strong> {{ formatDate(authStore.user?.createdAt) }}</p>
              <p v-if="authStore.user?.updatedAt"><strong>Last updated:</strong> {{ formatRelativeTime(authStore.user?.updatedAt) }}</p>
              <div class="status-indicator">
                <n-tag :type="authStore.user?.isActive ? 'success' : 'error'" round>
                  {{ authStore.user?.isActive ? 'Active' : 'Inactive' }}
                </n-tag>
              </div>
            </div>
          </div>
        </div>

        <n-divider />

        <!-- Profile Content Sections -->
        <div class="profile-content">
          <!-- Account Information Section -->
          <section class="profile-section">
            <h3><n-icon><InformationCircleIcon /></n-icon> Account Information</h3>
            <n-form
              ref="formRef"
              :model="formData"
              :rules="rules"
              label-placement="top"
              @submit.prevent="handleSubmit"
            >
              <div class="form-grid">
                <n-form-item label="Full Name" path="name">
                  <n-input
                    v-model:value="formData.name"
                    placeholder="Enter your full name"
                    :maxlength="120"
                    show-count
                  />
                </n-form-item>

                <n-form-item label="Email Address" path="email">
                  <n-input
                    v-model:value="formData.email"
                    type="email"
                    placeholder="Your email address"
                    disabled
                    :title="'Email cannot be changed'"
                  />
                </n-form-item>
              </div>
              
              <div class="account-details">
                <div class="detail-item">
                  <label>Account Type</label>
                  <span>{{ authStore.user?.roles.includes('admin') ? 'Administrator' : 'Standard User' }}</span>
                </div>
                <div class="detail-item">
                  <label>User ID</label>
                  <span>#{{ authStore.user?.id }}</span>
                </div>
              </div>
            </n-form>
          </section>

          <!-- Security Section -->
          <section class="profile-section">
            <h3><n-icon><LockClosedIcon /></n-icon> Security</h3>
            <div class="security-section">
              <div class="security-item">
                <div class="security-info">
                  <h4>Password</h4>
                  <p>Keep your account secure with a strong password</p>
                </div>
                <n-button @click="showPasswordForm = !showPasswordForm">
                  {{ showPasswordForm ? 'Cancel' : 'Change Password' }}
                </n-button>
              </div>
              
              <div v-if="showPasswordForm" class="password-form">
                <n-form :model="formData" :rules="rules">
                  <n-form-item label="Current Password" path="currentPassword">
                    <n-input
                      v-model:value="formData.currentPassword"
                      type="password"
                      placeholder="Enter your current password"
                      show-password-on="mousedown"
                      clearable
                    />
                  </n-form-item>

                  <n-form-item v-if="formData.currentPassword" label="New Password" path="newPassword">
                    <n-input
                      v-model:value="formData.newPassword"
                      type="password"
                      placeholder="Enter new password"
                      show-password-on="mousedown"
                      clearable
                    />
                    <password-strength-meter 
                      :password="formData.newPassword" 
                      :show-requirements="true"
                    />
                  </n-form-item>

                  <n-form-item v-if="formData.newPassword" label="Confirm New Password" path="confirmPassword">
                    <n-input
                      v-model:value="formData.confirmPassword"
                      type="password"
                      placeholder="Confirm your new password"
                      show-password-on="mousedown"
                      clearable
                    />
                  </n-form-item>
                </n-form>
              </div>
              
              <div class="security-item future-feature">
                <div class="security-info">
                  <h4>Two-Factor Authentication</h4>
                  <p>Add an extra layer of security to your account</p>
                </div>
                <n-button disabled secondary>
                  Enable 2FA (Coming Soon)
                </n-button>
              </div>
            </div>
          </section>

          <!-- Activity History Section -->
          <section class="profile-section">
            <h3><n-icon><TimeIcon /></n-icon> Recent Activity</h3>
            <div class="activity-section">
              <div v-if="recentActivity.length === 0" class="no-activity">
                <n-empty description="No recent activity to display" />
              </div>
              <div 
                v-for="activity in recentActivity" 
                :key="activity.id" 
                class="activity-item"
              >
                <n-icon :size="16"><ActivityIcon /></n-icon>
                <div class="activity-details">
                  <p>{{ activity.description }}</p>
                  <small>{{ formatRelativeTime(activity.timestamp) }}</small>
                </div>
              </div>
              <div v-if="recentActivity.length === 0" class="activity-placeholder">
                <p>Activity history will appear here once available.</p>
              </div>
            </div>
          </section>
        </div>

        <!-- Form Actions -->
        <div class="form-actions">
          <n-space>
            <n-button @click="handleCancel">Cancel</n-button>
            <n-button 
              type="primary" 
              :loading="loading" 
              @click="handleSubmit"
              :disabled="!hasChanges"
            >
              Save Changes
            </n-button>
          </n-space>
        </div>
      </div>
    </n-card>
  </n-modal>

  <!-- Avatar Upload Modal -->
  <avatar-upload 
    v-model:show="showAvatarUpload" 
    :current-avatar="authStore.user?.avatarUrl"
    @avatar-updated="handleAvatarUpdated"
    @cancel="showAvatarUpload = false"
  />
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import {
    FlashOutline as ActivityIcon,
    CloseOutline as CloseIcon,
    InformationCircleOutline as InformationCircleIcon,
    LockClosedOutline as LockClosedIcon,
    PersonOutline as PersonIcon,
    TimeOutline as TimeIcon
} from '@vicons/ionicons5';
import { useMessage } from 'naive-ui';
import { computed, reactive, ref, watch } from 'vue';
import AvatarUpload from '../AvatarUpload.vue';
import PasswordStrengthMeter from '../common/PasswordStrengthMeter.vue';

interface Props {
  show: boolean;
}

interface Emits {
  (e: 'update:show', value: boolean): void;
  (e: 'updated'): void;
}

interface Activity {
  id: string;
  description: string;
  timestamp: string;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const message = useMessage();
const authStore = useAuthStore();

// Form refs
const formRef = ref();
const loading = ref(false);
const showPasswordForm = ref(false);
const showAvatarUpload = ref(false);
const recentActivity = ref<Activity[]>([]);
const defaultAvatarUrl = '/default-avatar.png'; // Placeholder for default avatar

// Convert relative avatar URL to absolute URL
const userAvatarUrl = computed(() => {
  const avatarUrl = authStore.user?.avatarUrl;
  if (!avatarUrl) return defaultAvatarUrl;
  
  // If already absolute URL, return as is
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }
  
  // Convert relative URL to absolute URL
  // In development, the frontend serves static files, so we use the frontend URL
  const baseUrl = import.meta.env.DEV ? 'http://localhost:5173' : '';
  return `${baseUrl}${avatarUrl.startsWith('/') ? avatarUrl : '/' + avatarUrl}`;
});

// Form data
const formData = reactive({
  name: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  avatarUrl: ''
});

// Original form data for change detection
const originalFormData = ref({
  name: '',
  email: '',
  avatarUrl: ''
});

// Form validation rules
const rules = {
  name: [
    { required: true, message: 'Name is required', trigger: 'blur' },
    { min: 2, message: 'Name must be at least 2 characters', trigger: 'blur' },
    { max: 120, message: 'Name must not exceed 120 characters', trigger: 'blur' }
  ],
  currentPassword: [
    {
      validator: (_rule: any, value: string) => {
        if (formData.newPassword && !value) {
          return new Error('Current password is required to change password');
        }
        return true;
      },
      trigger: 'blur'
    }
  ],
  newPassword: [
    {
      validator: (_rule: any, value: string) => {
        if (formData.currentPassword && (!value || value.length < 8)) {
          return new Error('New password must be at least 8 characters');
        }
        return true;
      },
      trigger: 'input'
    }
  ],
  confirmPassword: [
    {
      validator: (_rule: any, value: string) => {
        if (formData.newPassword && value !== formData.newPassword) {
          return new Error('Passwords do not match');
        }
        return true;
      },
      trigger: 'input'
    }
  ]
};

// Computed
const show = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
});

const hasChanges = computed(() => {
  const nameChanged = formData.name !== originalFormData.value.name;
  const passwordChanging = formData.currentPassword && formData.newPassword && formData.confirmPassword;
  const avatarChanged = formData.avatarUrl !== originalFormData.value.avatarUrl;
  return nameChanged || passwordChanging || avatarChanged;
});

// Methods
function resetForm() {
  const user = authStore.user;
  formData.name = user?.name || '';
  formData.email = user?.email || '';
  formData.currentPassword = '';
  formData.newPassword = '';
  formData.confirmPassword = '';
  formData.avatarUrl = user?.avatarUrl || '';
  
  // Store original data for change detection
  originalFormData.value = {
    name: user?.name || '',
    email: user?.email || '',
    avatarUrl: user?.avatarUrl || ''
  };
  
  // Reset password form visibility
  showPasswordForm.value = false;
}

function capitalizeRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

async function handleSubmit() {
  try {
    console.log('🔄 UserProfile handleSubmit called');
    console.log('🔄 Form data:', formData);
    console.log('🔄 Original form data:', originalFormData.value);
    console.log('🔄 Has changes:', hasChanges.value);
    
    await formRef.value?.validate();
    loading.value = true;

    const updateData: any = {};

    // Only include name if it changed
    if (formData.name !== originalFormData.value.name) {
      updateData.name = formData.name;
      console.log('🔄 Name changed:', formData.name);
    }

    // Only include password if user wants to change it
    if (formData.currentPassword && formData.newPassword) {
      updateData.currentPassword = formData.currentPassword;
      updateData.password = formData.newPassword;
      console.log('🔄 Password change requested');
    }

    // Include avatarUrl if changed
    if (formData.avatarUrl !== originalFormData.value.avatarUrl) {
      updateData.avatarUrl = formData.avatarUrl;
      console.log('🔄 Avatar changed:', formData.avatarUrl);
    }

    console.log('🔄 Update data to send:', updateData);

    // Don't make request if nothing to update
    if (Object.keys(updateData).length === 0) {
      message.warning('No changes to save');
      return;
    }

    console.log('🔄 Calling authStore.updateProfile');
    const result = await authStore.updateProfile(updateData);
    console.log('🔄 Update result:', result);
    
    if (result.success) {
      message.success('Profile updated successfully');
      console.log('🔄 Emitting updated event');
      emit('updated');
      show.value = false;

      // Sync originals after successful save
      originalFormData.value = {
        name: formData.name,
        email: formData.email,
        avatarUrl: formData.avatarUrl
      };
    } else {
      message.error(result.message || 'Failed to update profile');
    }
  } catch (error) {
    console.log('❌ Form validation failed:', error);
  } finally {
    loading.value = false;
  }
}

function handleCancel() {
  resetForm();
  show.value = false;
}

function formatDate(dateString: string | undefined) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function formatRelativeTime(dateString: string | undefined) {
  if (!dateString) return 'N/A';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return formatDate(dateString);
}

// Load recent activity (placeholder implementation)
async function loadRecentActivity() {
  try {
    // This would typically fetch from /api/me/activity or similar
    // For now, we'll create placeholder data
    recentActivity.value = [
      // Placeholder - in real implementation this would come from API
    ];
  } catch (error) {
    console.log('Could not load activity history:', error);
    recentActivity.value = [];
  }
}

// Handle avatar update
function handleAvatarUpdated(avatarUrl: string) {
  // Update local form state & auth store
  authStore.updateUser({ avatarUrl });
  formData.avatarUrl = avatarUrl;
  // Don't update originalFormData here so Save button enables (user can confirm)
  // Emit updated immediately so outer components (e.g., dashboard header) refresh avatar
  emit('updated');
  showAvatarUpload.value = false;
}

// Watch for modal open to reset form and load data
watch(() => props.show, (newShow) => {
  if (newShow) {
    resetForm();
    loadRecentActivity();
  }
});
</script>

<style scoped>
.profile-container {
  max-height: 80vh;
  overflow-y: auto;
}

.profile-header {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  margin-bottom: 24px;
}

.profile-avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.change-avatar-btn {
  font-size: 12px;
}

.profile-info h2 {
  margin: 0 0 8px 0;
  color: var(--text-color-1);
}

.profile-info .email {
  color: var(--text-color-2);
  margin-bottom: 12px;
  font-size: 14px;
}

.role-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.account-meta p {
  margin: 4px 0;
  font-size: 13px;
  color: var(--text-color-2);
}

.account-meta strong {
  color: var(--text-color-1);
}

.status-indicator {
  margin-top: 8px;
}

.profile-content {
  space-y: 24px;
}

.profile-section {
  margin-bottom: 32px;
}

.profile-section h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  color: var(--text-color-1);
  font-size: 16px;
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.account-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
  padding: 16px;
  background-color: var(--card-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item label {
  font-size: 12px;
  color: var(--text-color-2);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-item span {
  font-size: 14px;
  color: var(--text-color-1);
}

.security-section {
  space-y: 16px;
}

.security-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  background-color: var(--card-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  margin-bottom: 16px;
}

.security-item.future-feature {
  opacity: 0.6;
}

.security-info h4 {
  margin: 0 0 4px 0;
  color: var(--text-color-1);
  font-size: 14px;
  font-weight: 600;
}

.security-info p {
  margin: 0;
  color: var(--text-color-2);
  font-size: 13px;
}

.password-form {
  margin-top: 16px;
  padding: 16px;
  background-color: var(--body-color);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.activity-section {
  min-height: 120px;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  margin-bottom: 8px;
  background-color: var(--card-color);
}

.activity-details p {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: var(--text-color-1);
}

.activity-details small {
  color: var(--text-color-3);
  font-size: 12px;
}

.activity-placeholder {
  text-align: center;
  padding: 32px;
  color: var(--text-color-3);
}

.no-activity {
  padding: 24px 0;
}

.form-actions {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
}

/* Responsive Design */
@media (max-width: 768px) {
  .profile-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .account-details {
    grid-template-columns: 1fr;
  }
  
  .security-item {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .profile-section h3 {
    font-size: 15px;
  }
}

@media (max-width: 480px) {
  .profile-container {
    padding: 8px;
  }
  
  .profile-header {
    gap: 12px;
  }
  
  .profile-avatar :deep(.n-avatar) {
    width: 64px;
    height: 64px;
  }
  
  .change-avatar-btn {
    font-size: 11px;
  }
  
  .profile-info h2 {
    font-size: 18px;
  }
  
  .form-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .form-actions :deep(.n-button) {
    width: 100%;
  }
  
  .account-details,
  .security-item,
  .activity-item {
    padding: 12px;
  }
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
  .account-details,
  .security-item,
  .activity-item {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .password-form {
    background-color: rgba(0, 0, 0, 0.2);
  }
}
</style>