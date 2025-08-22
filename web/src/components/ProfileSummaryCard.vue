<template>
  <n-card title="Profile Summary" class="profile-summary-card">
    <div class="profile-content">
      <div class="avatar-section">
        <n-avatar 
          :size="60" 
          :src="user?.avatarUrl" 
          :fallback-src="defaultAvatar"
          round
          class="profile-avatar"
        >
          {{ user?.name?.charAt(0)?.toUpperCase() || 'U' }}
        </n-avatar>
      </div>
      
      <div class="profile-details">
        <div class="profile-header">
          <h3 class="profile-name">{{ user?.name || 'Unknown User' }}</h3>
          <n-tag 
            :type="user?.roles?.includes('admin') ? 'success' : 'info'"
            size="small"
            class="role-badge"
          >
            {{ user?.roles?.includes('admin') ? 'Admin' : 'User' }}
          </n-tag>
        </div>
        
        <div class="profile-info">
          <div class="info-item">
            <n-icon class="info-icon"><MailOutline /></n-icon>
            <span class="info-text">{{ user?.email || 'No email' }}</span>
          </div>
          
          <div class="info-item">
            <n-icon class="info-icon"><CalendarOutline /></n-icon>
            <span class="info-text">Member since {{ formatDate(user?.createdAt) }}</span>
          </div>
          
          <div class="info-item">
            <n-icon class="info-icon" :class="{ active: user?.isActive, inactive: !user?.isActive }">
              <CheckmarkCircleOutline v-if="user?.isActive" />
              <CloseCircleOutline v-else />
            </n-icon>
            <span class="info-text">
              Account {{ user?.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <template #footer>
      <n-button type="primary" ghost @click="$emit('edit-profile')">
        <template #icon>
          <n-icon><PersonOutline /></n-icon>
        </template>
        Edit Profile
      </n-button>
    </template>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { User } from '@/stores/auth';
import {
  MailOutline,
  CalendarOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
  PersonOutline
} from '@vicons/ionicons5';

interface Props {
  user: User | null;
}

interface Emits {
  (e: 'edit-profile'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const defaultAvatar = computed(() => 
  `https://api.dicebear.com/7.x/initials/svg?seed=${props.user?.name || 'User'}`
);

function formatDate(dateString: string | undefined) {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleDateString();
}
</script>

<style scoped>
.profile-summary-card {
  height: 100%;
}

.profile-content {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.avatar-section {
  flex-shrink: 0;
}

.profile-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
}

.profile-details {
  flex: 1;
  min-width: 0;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.profile-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role-badge {
  flex-shrink: 0;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-icon {
  color: #666;
  flex-shrink: 0;
}

.info-icon.active {
  color: #18a058;
}

.info-icon.inactive {
  color: #d03050;
}

.info-text {
  font-size: 14px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Responsive Design */
@media (max-width: 768px) {
  .profile-content {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }
  
  .profile-header {
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  
  .profile-name {
    font-size: 16px;
  }
  
  .info-item {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .profile-summary-card :deep(.n-card__content) {
    padding: 16px;
  }
  
  .profile-content {
    gap: 8px;
  }
  
  .profile-header {
    margin-bottom: 8px;
  }
  
  .profile-info {
    gap: 6px;
  }
  
  .info-text {
    font-size: 13px;
  }
}
</style>