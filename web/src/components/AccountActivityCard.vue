<template>
  <n-card title="Account Activity" class="account-activity-card">
    <div class="activity-content">
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">{{ formatDate(user?.createdAt) }}</div>
          <div class="stat-label">Account Created</div>
        </div>
        
        <div class="stat-item">
          <div class="stat-value">{{ formatDate(user?.updatedAt) || 'Never' }}</div>
          <div class="stat-label">Last Updated</div>
        </div>
        
        <div class="stat-item">
          <div class="stat-value">{{ user?.roles?.length || 0 }}</div>
          <div class="stat-label">{{ user?.roles?.length === 1 ? 'Role' : 'Roles' }}</div>
        </div>
        
        <div class="stat-item">
          <div class="stat-value" :class="{ active: user?.isActive, inactive: !user?.isActive }">
            {{ user?.isActive ? 'Active' : 'Inactive' }}
          </div>
          <div class="stat-label">Account Status</div>
        </div>
      </div>
      
      <n-divider />
      
      <div class="activity-list">
        <h4 class="activity-title">Recent Activity</h4>
        <div class="activity-items">
          <div class="activity-item">
            <n-icon class="activity-icon" color="#18a058">
              <CheckmarkCircleOutline />
            </n-icon>
            <div class="activity-details">
              <div class="activity-description">Account created</div>
              <div class="activity-time">{{ formatDateTime(user?.createdAt) }}</div>
            </div>
          </div>
          
          <div v-if="user?.updatedAt" class="activity-item">
            <n-icon class="activity-icon" color="#2080f0">
              <CreateOutline />
            </n-icon>
            <div class="activity-details">
              <div class="activity-description">Profile updated</div>
              <div class="activity-time">{{ formatDateTime(user?.updatedAt) }}</div>
            </div>
          </div>
          
          <div class="activity-item">
            <n-icon class="activity-icon" color="#f0a020">
              <LogInOutline />
            </n-icon>
            <div class="activity-details">
              <div class="activity-description">Last login</div>
              <div class="activity-time">{{ getCurrentTime() }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import type { User } from '@/stores/auth';
import {
  CheckmarkCircleOutline,
  CreateOutline,
  LogInOutline
} from '@vicons/ionicons5';

interface Props {
  user: User | null;
}

const props = defineProps<Props>();

function formatDate(dateString: string | undefined) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString();
}

function formatDateTime(dateString: string | undefined) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString();
}

function getCurrentTime() {
  return new Date().toLocaleString();
}
</script>

<style scoped>
.account-activity-card {
  height: 100%;
}

.activity-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 8px;
}

.stat-item {
  text-align: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.stat-value.active {
  color: #18a058;
}

.stat-value.inactive {
  color: #d03050;
}

.stat-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.activity-list {
  flex: 1;
}

.activity-title {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.activity-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.activity-item:hover {
  background: #f8f9fa;
}

.activity-icon {
  margin-top: 2px;
  flex-shrink: 0;
}

.activity-details {
  flex: 1;
  min-width: 0;
}

.activity-description {
  font-size: 14px;
  color: #333;
  margin-bottom: 2px;
}

.activity-time {
  font-size: 12px;
  color: #666;
}

/* Responsive Design */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .stat-item {
    padding: 10px;
  }
  
  .stat-value {
    font-size: 16px;
  }
  
  .activity-item {
    padding: 6px;
    gap: 10px;
  }
  
  .activity-description {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .account-activity-card :deep(.n-card__content) {
    padding: 16px;
  }
  
  .stats-grid {
    gap: 8px;
  }
  
  .stat-item {
    padding: 8px;
  }
  
  .stat-value {
    font-size: 14px;
  }
  
  .stat-label {
    font-size: 11px;
  }
  
  .activity-items {
    gap: 8px;
  }
  
  .activity-item {
    gap: 8px;
  }
  
  .activity-description {
    font-size: 12px;
  }
  
  .activity-time {
    font-size: 11px;
  }
}
</style>