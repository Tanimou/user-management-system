<template>
  <n-modal v-model:show="visible" style="width: 500px">
    <n-card title="Change Profile Photo" :bordered="false" size="huge" role="dialog" aria-modal="true">
      <template #header-extra>
        <n-button quaternary circle @click="handleCancel">
          <template #icon>
            <n-icon><CloseIcon /></n-icon>
          </template>
        </n-button>
      </template>

      <div class="avatar-upload-container">
        <!-- Current Avatar Preview -->
        <div class="current-avatar">
          <n-avatar 
            :size="120" 
            :src="currentAvatar" 
            :fallback-src="defaultAvatarUrl"
            round
          >
            <template #fallback>
              <n-icon :size="60"><PersonIcon /></n-icon>
            </template>
          </n-avatar>
          <p class="current-label">Current Photo</p>
        </div>

        <!-- Upload Section -->
        <div class="upload-section">
          <n-upload
            ref="uploadRef"
            :max="1"
            accept="image/*"
            :show-file-list="false"
            @before-upload="handleBeforeUpload"
            @finish="handleUploadFinish"
            @error="handleUploadError"
          >
            <n-upload-dragger>
              <div style="margin-bottom: 12px">
                <n-icon size="48" :depth="3">
                  <CloudUploadIcon />
                </n-icon>
              </div>
              <n-text style="font-size: 16px">
                Click or drag an image here to upload
              </n-text>
              <n-p depth="3" style="margin: 8px 0 0 0">
                JPG, PNG, GIF up to 5MB
              </n-p>
            </n-upload-dragger>
          </n-upload>

          <!-- Preview New Image -->
          <div v-if="previewUrl" class="preview-section">
            <h4>Preview:</h4>
            <n-avatar :size="120" :src="previewUrl" round />
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="form-actions">
          <n-space>
            <n-button @click="handleCancel">Cancel</n-button>
            <n-button 
              type="primary" 
              :loading="uploading" 
              :disabled="!previewUrl"
              @click="handleSave"
            >
              Save Photo
            </n-button>
          </n-space>
        </div>
      </div>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMessage } from 'naive-ui';
import { 
  CloseOutline as CloseIcon,
  PersonOutline as PersonIcon,
  CloudUploadOutline as CloudUploadIcon
} from '@vicons/ionicons5';
import { apiClient } from '../api/axios';

interface Props {
  show: boolean;
  currentAvatar?: string;
}

interface Emits {
  (e: 'update:show', value: boolean): void;
  (e: 'avatar-updated', avatarUrl: string): void;
  (e: 'cancel'): void;
}

const props = withDefaults(defineProps<Props>(), {
  currentAvatar: ''
});

const emit = defineEmits<Emits>();
const message = useMessage();

const uploading = ref(false);
const previewUrl = ref('');
const selectedFile = ref<File | null>(null);
const defaultAvatarUrl = '/default-avatar.png';

const visible = computed({
  get: () => props.show,
  set: (value) => {
    if (!value) {
      emit('update:show', false);
    }
  }
});

function handleBeforeUpload(options: { file: File; fileList: File[] }) {
  const file = options.file;
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    message.error('Please upload an image file');
    return false;
  }
  
  // Validate file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    message.error('File size must be less than 5MB');
    return false;
  }
  
  selectedFile.value = file;
  
  // Create preview URL
  const reader = new FileReader();
  reader.onload = (e) => {
    previewUrl.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
  
  return false; // Prevent automatic upload
}

function handleUploadFinish() {
  // This would be called if we allowed automatic upload
  uploading.value = false;
}

function handleUploadError() {
  uploading.value = false;
  message.error('Upload failed');
}

async function handleSave() {
  if (!selectedFile.value) {
    message.warning('Please select an image first');
    return;
  }

  uploading.value = true;
  
  try {
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('avatar', selectedFile.value);

    // Upload to backend
    const response = await apiClient.uploadFile<{ message: string; data: { user: any; avatarUrl: string } }>('/upload-avatar', formData);
    
    if (response && response.data && response.data.avatarUrl) {
      const uploadedUrl = response.data.avatarUrl;
      emit('avatar-updated', uploadedUrl);
      message.success(response.message || 'Profile photo updated successfully!');
      visible.value = false;
      resetForm();
    } else {
      throw new Error('Invalid response from server');
    }
    
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    let errorMessage = 'Failed to upload photo. Please try again.';
    
    if (error.response && error.response.data && error.response.data.error) {
      errorMessage = error.response.data.error;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    message.error(errorMessage);
  } finally {
    uploading.value = false;
  }
}

function handleCancel() {
  resetForm();
  emit('cancel');
  visible.value = false;
}

function resetForm() {
  previewUrl.value = '';
  selectedFile.value = null;
  uploading.value = false;
}
</script>

<style scoped>
.avatar-upload-container {
  padding: 16px 0;
}

.current-avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.current-label {
  font-size: 14px;
  color: var(--text-color-2);
  margin: 0;
}

.upload-section {
  margin-bottom: 24px;
}

.preview-section {
  margin-top: 24px;
  text-align: center;
}

.preview-section h4 {
  margin: 0 0 12px 0;
  color: var(--text-color-1);
  font-size: 14px;
}

.form-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
}

/* Mobile responsive */
@media (max-width: 480px) {
  .current-avatar :deep(.n-avatar) {
    width: 100px !important;
    height: 100px !important;
  }
  
  .preview-section :deep(.n-avatar) {
    width: 100px !important;
    height: 100px !important;
  }
  
  .form-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .form-actions :deep(.n-button) {
    width: 100%;
  }
}
</style>