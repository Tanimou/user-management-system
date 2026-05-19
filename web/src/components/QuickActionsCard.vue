<template>
  <n-card title="Quick Actions" class="quick-actions-card">
    <div class="actions-content">
      <div class="action-buttons">
        <n-button 
          type="primary" 
          ghost 
          block 
          @click="$emit('edit-profile')"
          class="action-button"
        >
          <template #icon>
            <n-icon><PersonOutline /></n-icon>
          </template>
          Edit Profile
        </n-button>
        
        <n-button 
          type="info" 
          ghost 
          block 
          @click="$emit('change-password')"
          class="action-button"
        >
          <template #icon>
            <n-icon><LockClosedOutline /></n-icon>
          </template>
          Change Password
        </n-button>
        
        <n-button 
          type="warning" 
          ghost 
          block 
          @click="$emit('view-activity')"
          class="action-button"
        >
          <template #icon>
            <n-icon><TimeOutline /></n-icon>
          </template>
          View Activity
        </n-button>
      </div>
      
      <n-divider />
      
      <div class="help-section">
        <h4 class="help-title">
          <n-icon class="help-icon"><HelpCircleOutline /></n-icon>
          Help & Support
        </h4>
        <div class="help-items">
          <a 
            href="#" 
            @click.prevent="$emit('view-help')" 
            class="help-link"
          >
            <n-icon><DocumentTextOutline /></n-icon>
            User Guide
          </a>
          <a 
            href="#" 
            @click.prevent="$emit('contact-support')" 
            class="help-link"
          >
            <n-icon><ChatbubbleEllipsesOutline /></n-icon>
            Contact Support
          </a>
          <a 
            href="#" 
            @click.prevent="$emit('view-faq')" 
            class="help-link"
          >
            <n-icon><InformationCircleOutline /></n-icon>
            FAQ
          </a>
        </div>
      </div>
      
      <n-divider />
      
      <div class="announcements-section">
        <h4 class="announcements-title">
          <n-icon class="announcements-icon"><NotificationsOutline /></n-icon>
          System Announcements
        </h4>
        <div class="announcement-items">
          <div class="announcement-item">
            <div class="announcement-dot"></div>
            <div class="announcement-content">
              <div class="announcement-text">
                Welcome to the User Management System! Your account is ready to use.
              </div>
              <div class="announcement-time">Just now</div>
            </div>
          </div>
          <div class="announcement-item">
            <div class="announcement-dot system"></div>
            <div class="announcement-content">
              <div class="announcement-text">
                System maintenance scheduled for next weekend.
              </div>
              <div class="announcement-time">2 days ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import {
  PersonOutline,
  LockClosedOutline,
  TimeOutline,
  HelpCircleOutline,
  DocumentTextOutline,
  ChatbubbleEllipsesOutline,
  InformationCircleOutline,
  NotificationsOutline
} from '@vicons/ionicons5';

interface Emits {
  (e: 'edit-profile'): void;
  (e: 'change-password'): void;
  (e: 'view-activity'): void;
  (e: 'view-help'): void;
  (e: 'contact-support'): void;
  (e: 'view-faq'): void;
}

const emit = defineEmits<Emits>();
</script>

<style scoped>
.quick-actions-card {
  height: 100%;
}

.actions-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 8px;
}

.action-button {
  height: 40px;
  border-radius: 8px;
  font-weight: 500;
}

.help-section {
  margin-bottom: 8px;
}

.help-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
}

.help-icon {
  color: #2080f0;
}

.help-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.help-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  text-decoration: none;
  color: #666;
  font-size: 14px;
  transition: all 0.2s;
}

.help-link:hover {
  background: #f8f9fa;
  color: #333;
}

.announcements-section {
  flex: 1;
}

.announcements-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
}

.announcements-icon {
  color: #f0a020;
}

.announcement-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.announcement-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px;
  border-radius: 6px;
  background: #f8f9fa;
}

.announcement-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #18a058;
  margin-top: 6px;
  flex-shrink: 0;
}

.announcement-dot.system {
  background: #2080f0;
}

.announcement-content {
  flex: 1;
  min-width: 0;
}

.announcement-text {
  font-size: 13px;
  color: #333;
  line-height: 1.4;
  margin-bottom: 2px;
}

.announcement-time {
  font-size: 11px;
  color: #666;
}

/* Responsive Design */
@media (max-width: 768px) {
  .action-buttons {
    gap: 10px;
  }
  
  .action-button {
    height: 36px;
  }
  
  .help-link {
    padding: 6px 10px;
    font-size: 13px;
  }
  
  .announcement-item {
    padding: 6px;
    gap: 10px;
  }
  
  .announcement-text {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .quick-actions-card :deep(.n-card__content) {
    padding: 16px;
  }
  
  .action-buttons {
    gap: 8px;
  }
  
  .action-button {
    height: 32px;
    font-size: 13px;
  }
  
  .help-items {
    gap: 6px;
  }
  
  .help-link {
    padding: 6px 8px;
    font-size: 12px;
  }
  
  .announcement-items {
    gap: 8px;
  }
  
  .announcement-text {
    font-size: 11px;
  }
  
  .announcement-time {
    font-size: 10px;
  }
}
</style>