<template>
  <n-modal 
    v-model:show="visible"
    :close-on-esc="false"
    :close-on-click-mask="false"
    :mask-closable="false"
  >
    <n-card
      style="width: 600px"
      :title="title"
      :bordered="false"
      size="huge"
      role="dialog"
      aria-modal="true"
    >
      <template #header-extra>
        <n-icon
          :size="24"
          :color="confirmationType === 'warning' ? '#f0a020' : '#e88080'"
        >
          <component :is="confirmationType === 'warning' ? WarningOutline : CloseCircleOutline" />
        </n-icon>
      </template>

      <div class="confirmation-content">
        <p class="message">{{ message }}</p>
        
        <div v-if="roleChanges" class="role-changes">
          <div v-if="roleChanges.added.length > 0" class="role-change-section">
            <strong>Roles to be added:</strong>
            <div class="role-tags">
              <n-tag 
                v-for="role in roleChanges.added"
                :key="`add-${role}`"
                type="success"
                size="small"
              >
                + {{ role }}
              </n-tag>
            </div>
          </div>

          <div v-if="roleChanges.removed.length > 0" class="role-change-section">
            <strong>Roles to be removed:</strong>
            <div class="role-tags">
              <n-tag 
                v-for="role in roleChanges.removed"
                :key="`remove-${role}`"
                type="error"
                size="small"
              >
                - {{ role }}
              </n-tag>
            </div>
          </div>
        </div>

        <div v-if="details" class="details">
          <n-alert type="info" :show-icon="false">
            {{ details }}
          </n-alert>
        </div>
      </div>

      <template #footer>
        <div class="confirmation-actions">
          <n-space>
            <n-button @click="handleCancel">
              {{ cancelText }}
            </n-button>
            <n-button 
              :type="confirmationType === 'warning' ? 'warning' : 'error'"
              :loading="loading"
              @click="handleConfirm"
            >
              {{ confirmText }}
            </n-button>
          </n-space>
        </div>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { WarningOutline, CloseCircleOutline } from '@vicons/ionicons5';

interface RoleChanges {
  added: string[];
  removed: string[];
}

interface Props {
  show: boolean;
  title?: string;
  message: string;
  details?: string;
  roleChanges?: RoleChanges | null;
  confirmationType?: 'warning' | 'error';
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm Action',
  confirmationType: 'warning',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  loading: false,
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => {
    if (!value) {
      emit('cancel');
    }
  }
});

function handleConfirm() {
  emit('confirm');
}

function handleCancel() {
  emit('cancel');
}
</script>

<style scoped>
.confirmation-content {
  margin: 16px 0;
}

.message {
  font-size: 16px;
  margin-bottom: 16px;
  color: var(--text-color-1);
}

.role-changes {
  margin: 16px 0;
}

.role-change-section {
  margin-bottom: 12px;
}

.role-change-section strong {
  display: block;
  margin-bottom: 8px;
  color: var(--text-color-1);
}

.role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.details {
  margin-top: 16px;
}

.confirmation-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .n-card {
    width: 90vw !important;
    max-width: 500px;
  }
  
  .role-tags {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>