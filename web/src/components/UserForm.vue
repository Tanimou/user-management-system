<template>
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
        placeholder="Enter full name"
        :maxlength="120"
        show-count
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
      />
    </n-form-item>

    <n-form-item label="Password" path="password">
      <n-input
        v-model:value="formData.password"
        type="password"
        :placeholder="isEditing ? 'Leave blank to keep current password' : 'Enter password'"
        show-password-on="mousedown"
        clearable
      />
    </n-form-item>

    <n-form-item v-if="authStore.isAdmin" label="Roles" path="roles">
      <n-select
        v-model:value="formData.roles"
        multiple
        :options="roleOptions"
        placeholder="Select user roles"
      />
    </n-form-item>

    <n-form-item v-if="authStore.isAdmin && isEditing && !isSelf" label="Status" path="isActive">
      <n-switch
        v-model:value="formData.isActive"
        :checked-value="true"
        :unchecked-value="false"
      >
        <template #checked>Active</template>
        <template #unchecked>Inactive</template>
      </n-switch>
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
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useAuthStore, type User } from '@/stores/auth';

interface Props {
  user?: User | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  save: [userData: any];
  cancel: [];
}>();

const authStore = useAuthStore();

// Computed
const isEditing = computed(() => !!props.user);
const isSelf = computed(() => props.user?.id === authStore.user?.id);

// Form data
const formData = reactive({
  name: '',
  email: '',
  password: '',
  roles: ['user'] as string[],
  isActive: true,
});

// Form rules
const rules = computed(() => ({
  name: [
    { required: true, message: 'Name is required', trigger: 'blur' },
    { max: 120, message: 'Name cannot exceed 120 characters', trigger: 'blur' }
  ],
  email: !isEditing.value || authStore.isAdmin ? [
    { required: true, message: 'Email is required', trigger: 'blur' },
    { type: 'email', message: 'Please enter a valid email', trigger: 'blur' },
    { max: 180, message: 'Email cannot exceed 180 characters', trigger: 'blur' }
  ] : [],
  password: isEditing.value ? [
    { min: 8, message: 'Password must be at least 8 characters', trigger: 'blur', validator: (rule: any, value: string) => {
      if (!value) return true; // Empty password is allowed for editing
      return value.length >= 8;
    } }
  ] : [
    { required: true, message: 'Password is required', trigger: 'blur' },
    { min: 8, message: 'Password must be at least 8 characters', trigger: 'blur' }
  ],
  roles: [
    { 
      type: 'array', 
      min: 1, 
      message: 'At least one role is required', 
      trigger: 'change',
      validator: (rule: any, value: string[]) => {
        return value && value.includes('user');
      }
    }
  ],
}));

// Role options
const roleOptions = [
  { label: 'User', value: 'user' },
  { label: 'Admin', value: 'admin' },
];

// State
const loading = ref(false);
const formRef = ref();

// Watch for user changes
watch(() => props.user, (user) => {
  if (user) {
    formData.name = user.name;
    formData.email = user.email;
    formData.password = '';
    formData.roles = [...user.roles];
    formData.isActive = user.isActive;
  } else {
    // Reset form for create mode
    formData.name = '';
    formData.email = '';
    formData.password = '';
    formData.roles = ['user'];
    formData.isActive = true;
  }
}, { immediate: true });

// Methods
async function handleSubmit() {
  try {
    await formRef.value?.validate();
    
    loading.value = true;
    
    const userData: any = {
      name: formData.name,
    };

    // Only include email for new users or if admin is editing
    if (!isEditing.value || authStore.isAdmin) {
      userData.email = formData.email;
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

    emit('save', userData);
  } catch (error) {
    // Form validation failed
    console.log('Form validation failed:', error);
  } finally {
    loading.value = false;
  }
}

function handleCancel() {
  emit('cancel');
}
</script>

<style scoped>
.form-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}
</style>