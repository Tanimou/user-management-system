<template>
  <n-modal v-model:show="show" preset="dialog" title="User Profile">
    <n-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-placement="top"
      @submit.prevent="handleSubmit"
    >
      <n-form-item label="Name" path="name">
        <n-input
          v-model:value="formData.name"
          placeholder="Enter your full name"
          :maxlength="120"
          show-count
        />
      </n-form-item>

      <n-form-item label="Email" path="email">
        <n-input
          v-model:value="formData.email"
          type="email"
          placeholder="Your email address"
          disabled
          :title="'Email cannot be changed'"
        />
      </n-form-item>

      <n-form-item label="Current Password" path="currentPassword">
        <n-input
          v-model:value="formData.currentPassword"
          type="password"
          placeholder="Enter current password to change it"
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
      </n-form-item>

      <n-form-item v-if="formData.newPassword" label="Confirm New Password" path="confirmPassword">
        <n-input
          v-model:value="formData.confirmPassword"
          type="password"
          placeholder="Confirm new password"
          show-password-on="mousedown"
          clearable
        />
      </n-form-item>

      <n-divider />

      <div class="profile-info">
        <n-descriptions :column="1" bordered>
          <n-descriptions-item label="User ID">
            {{ authStore.user?.id }}
          </n-descriptions-item>
          <n-descriptions-item label="Roles">
            <n-space>
              <n-tag 
                v-for="role in authStore.user?.roles" 
                :key="role"
                :type="role === 'admin' ? 'warning' : 'info'"
              >
                {{ role }}
              </n-tag>
            </n-space>
          </n-descriptions-item>
          <n-descriptions-item label="Account Status">
            <n-tag :type="authStore.user?.isActive ? 'success' : 'error'">
              {{ authStore.user?.isActive ? 'Active' : 'Inactive' }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="Member Since">
            {{ formatDate(authStore.user?.createdAt) }}
          </n-descriptions-item>
          <n-descriptions-item v-if="authStore.user?.updatedAt" label="Last Updated">
            {{ formatDate(authStore.user?.updatedAt) }}
          </n-descriptions-item>
        </n-descriptions>
      </div>

      <div class="form-actions">
        <n-space>
          <n-button @click="handleCancel">Cancel</n-button>
          <n-button type="primary" :loading="loading" @click="handleSubmit">
            Update Profile
          </n-button>
        </n-space>
      </div>
    </n-form>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useMessage } from 'naive-ui';
import { useAuthStore } from '@/stores/auth';

interface Props {
  show: boolean;
}

interface Emits {
  (e: 'update:show', value: boolean): void;
  (e: 'updated'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const message = useMessage();
const authStore = useAuthStore();

// Form refs
const formRef = ref();
const loading = ref(false);

// Form data
const formData = reactive({
  name: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

// Form validation rules
const rules = {
  name: [
    { required: true, message: 'Name is required', trigger: 'blur' },
    { min: 2, message: 'Name must be at least 2 characters', trigger: 'blur' },
    { max: 120, message: 'Name must not exceed 120 characters', trigger: 'blur' }
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

// Methods
function resetForm() {
  formData.name = authStore.user?.name || '';
  formData.email = authStore.user?.email || '';
  formData.currentPassword = '';
  formData.newPassword = '';
  formData.confirmPassword = '';
}

async function handleSubmit() {
  try {
    await formRef.value?.validate();
    loading.value = true;

    const updateData: any = {
      name: formData.name
    };

    // Only include password if user wants to change it
    if (formData.currentPassword && formData.newPassword) {
      updateData.currentPassword = formData.currentPassword;
      updateData.password = formData.newPassword;
    }

    const result = await authStore.updateProfile(updateData);
    
    if (result.success) {
      message.success('Profile updated successfully');
      emit('updated');
      show.value = false;
    } else {
      message.error(result.message || 'Failed to update profile');
    }
  } catch (error) {
    console.log('Form validation failed:', error);
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
  return new Date(dateString).toLocaleString();
}

// Watch for modal open to reset form
watch(() => props.show, (newShow) => {
  if (newShow) {
    resetForm();
  }
});
</script>

<style scoped>
.profile-info {
  margin: 24px 0;
}

.form-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .profile-info {
    margin: 16px 0;
  }
  
  :deep(.n-descriptions) {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .form-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .form-actions :deep(.n-button) {
    width: 100%;
  }
  
  :deep(.n-descriptions) {
    font-size: 12px;
  }
  
  :deep(.n-descriptions-item-label) {
    min-width: 80px;
  }
}
</style>