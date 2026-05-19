<template>
  <div class="user-table-container">
    <!-- Desktop/Tablet Table View -->
    <n-card class="desktop-table">
      <n-data-table
        :columns="columns"
        :data="users"
        :loading="loading"
        :pagination="false"
        :bordered="false"
        @update:sorter="handleSorterChange"
      />
    </n-card>

    <!-- Mobile Card View -->
    <div class="mobile-cards">
      <n-spin :show="loading" class="mobile-loading">
        <div v-if="users.length === 0" class="no-users">
          <n-empty description="No users found" />
        </div>
        <div v-else class="user-cards-grid">
          <n-card 
            v-for="user in users" 
            :key="user.id" 
            class="user-card"
            hoverable
          >
            <div class="user-card-header">
              <div class="user-avatar-section">
                <n-avatar 
                  :size="40"
                  :src="user.avatarUrl"
                  round
                  class="user-avatar"
                >
                  {{ user.name?.charAt(0)?.toUpperCase() || 'U' }}
                </n-avatar>
                <div class="user-basic-info">
                  <h3 class="user-name">{{ user.name }}</h3>
                  <p class="user-email">{{ user.email }}</p>
                </div>
              </div>
              <n-tag 
                :type="user.isActive ? 'success' : 'error'"
                size="small"
              >
                {{ user.isActive ? 'Active' : 'Inactive' }}
              </n-tag>
            </div>
            
            <div class="user-card-body">
              <div class="user-detail">
                <span class="label">ID:</span>
                <span class="value">{{ user.id }}</span>
              </div>
              <div class="user-detail">
                <span class="label">Roles:</span>
                <span class="value">
                  <n-tag 
                    v-for="role in user.roles" 
                    :key="role"
                    :type="role === 'admin' ? 'success' : 'info'"
                    size="tiny"
                    class="role-tag"
                  >
                    {{ role }}
                  </n-tag>
                </span>
              </div>
              <div class="user-detail">
                <span class="label">Created:</span>
                <span class="value">{{ new Date(user.createdAt).toLocaleDateString() }}</span>
              </div>
              <div class="user-detail">
                <span class="label">Updated:</span>
                <span class="value">{{ user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'Never' }}</span>
              </div>
              <div v-if="showDeletedColumn && user.deletedAt" class="user-detail">
                <span class="label">Deleted:</span>
                <span class="value">{{ new Date(user.deletedAt).toLocaleDateString() }}</span>
              </div>
            </div>

            <div class="user-card-actions">
              <n-space size="small">
                <n-button
                  v-if="authStore.isAdmin"
                  size="small"
                  type="primary"
                  ghost
                  @click="handleEdit(user)"
                >
                  <template #icon>
                    <n-icon><EditIcon /></n-icon>
                  </template>
                  Edit
                </n-button>
                <n-button
                  v-if="authStore.isAdmin && user.id !== authStore.user?.id"
                  size="small"
                  :type="user.isActive ? 'error' : 'success'"
                  ghost
                  @click="user.isActive ? handleDelete(user) : handleRestore(user)"
                >
                  <template #icon>
                    <n-icon>
                      <DeleteIcon v-if="user.isActive" />
                      <RestoreIcon v-else />
                    </n-icon>
                  </template>
                  {{ user.isActive ? 'Delete' : 'Restore' }}
                </n-button>
              </n-space>
            </div>
          </n-card>
        </div>
      </n-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue';
import { type DataTableColumns } from 'naive-ui';
import { 
  Create as EditIcon,
  Trash as DeleteIcon,
  Refresh as RestoreIcon
} from '@vicons/ionicons5';
import { useAuthStore, type User } from '@/stores/auth';
import { getColumnSortOrder } from '@/utils/sorting';

interface Props {
  users: User[];
  loading: boolean;
  sorting: {
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  showDeletedColumn?: boolean;
}

interface Emits {
  (e: 'update:sorter', sorterInfo: any): void;
  (e: 'edit', user: User): void;
  (e: 'delete', user: User): void;
  (e: 'restore', user: User): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const authStore = useAuthStore();

// Table columns
const columns = computed<DataTableColumns<User>>(() => {
  const isAdmin = authStore.isAdmin;
  const currentUserId = authStore.user?.id;
  
  return [
  { title: 'ID', key: 'id', width: 80 },
  { 
    title: 'Name', 
    key: 'name',
    sorter: true,
    sortOrder: getColumnSortOrder('name', props.sorting.sortBy, props.sorting.sortOrder)
  },
  { 
    title: 'Email', 
    key: 'email',
    sorter: true,
    sortOrder: getColumnSortOrder('email', props.sorting.sortBy, props.sorting.sortOrder)
  },
  {
    title: 'Roles',
    key: 'roles',
    render: (row) => h('span', row.roles.join(', ')),
  },
  {
    title: 'Status',
    key: 'isActive',
    render: (row) => h('div', { style: 'display: flex; flex-direction: column; gap: 2px;' }, [
      h(
        'n-tag',
        { type: row.isActive ? 'success' : 'error' },
        { default: () => row.isActive ? 'Active' : 'Inactive' }
      ),
      !row.isActive && row.deletedAt ? h(
        'small',
        { style: 'color: #666; font-size: 11px;' },
        `Deleted: ${new Date(row.deletedAt).toLocaleDateString()}`
      ) : null,
    ]),
  },
  {
    title: 'Created',
    key: 'createdAt',
    sorter: true,
    sortOrder: getColumnSortOrder('createdAt', props.sorting.sortBy, props.sorting.sortOrder),
    render: (row) => new Date(row.createdAt).toLocaleDateString(),
  },
  // Conditionally add deleted column for deactivated users view
  ...(props.showDeletedColumn ? [{
    title: 'Deleted',
    key: 'deletedAt',
    sorter: true,
    sortOrder: getColumnSortOrder('deletedAt', props.sorting.sortBy, props.sorting.sortOrder),
    render: (row: User) => row.deletedAt ? new Date(row.deletedAt).toLocaleDateString() : '-',
    width: 120,
  }] : []),
  {
    title: 'Updated',
    key: 'updatedAt',
    sorter: true,
    sortOrder: getColumnSortOrder('updatedAt', props.sorting.sortBy, props.sorting.sortOrder),
    render: (row) => row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : 'Never',
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 200,
    render: (row) => {
      const buttons = [];
      
      // Edit button - admin only
      if (isAdmin) {
        buttons.push(
          h('n-button', {
            size: 'small',
            type: 'primary',
            ghost: true,
            onClick: () => handleEdit(row),
            style: { 
              marginRight: '6px', 
              fontSize: '12px',
              cursor: 'pointer',
              minHeight: '32px',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              border: '1px solid rgba(24, 160, 88, 0.3)',
              color: 'rgba(24, 160, 88, 0.9)',
              backgroundColor: 'transparent'
            }
          }, [
            h('n-icon', { style: { marginRight: '4px', fontSize: '14px' } }, [h(EditIcon)]),
            'Edit'
          ])
        );
      }
      
      // Delete/Restore buttons - admin only, cannot affect self
      if (isAdmin && row.id !== currentUserId) {
        if (row.isActive) {
          buttons.push(
            h('n-button', {
              size: 'small',
              type: 'error',
              ghost: true,
              onClick: () => handleDelete(row),
              style: { 
                fontSize: '12px',
                cursor: 'pointer',
                minHeight: '32px',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                border: '1px solid rgba(208, 58, 82, 0.3)',
                color: 'rgba(208, 58, 82, 0.9)',
                backgroundColor: 'transparent'
              }
            }, [
              h('n-icon', { style: { marginRight: '4px', fontSize: '14px' } }, [h(DeleteIcon)]),
              'Delete'
            ])
          );
        } else {
          buttons.push(
            h('n-button', {
              size: 'small',
              type: 'success',
              ghost: true,
              onClick: () => handleRestore(row),
              style: { 
                fontSize: '12px',
                cursor: 'pointer',
                minHeight: '32px',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                border: '1px solid rgba(24, 160, 88, 0.3)',
                color: 'rgba(24, 160, 88, 0.9)',
                backgroundColor: 'transparent'
              }
            }, [
              h('n-icon', { style: { marginRight: '4px', fontSize: '14px' } }, [h(RestoreIcon)]),
              'Restore'
            ])
          );
        }
      }
      
      return h('div', { 
        style: { 
          display: 'flex', 
          gap: '8px', 
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px'
        } 
      }, buttons);
    },
  },
];
});

// Methods - remove pagination handling as it's now external
function handleSorterChange(sorterInfo: any) {
  emit('update:sorter', sorterInfo);
}

function handleEdit(user: User) {
  emit('edit', user);
}

function handleDelete(user: User) {
  emit('delete', user);
}

function handleRestore(user: User) {
  emit('restore', user);
}
</script>

<style scoped>
.user-table-container {
  position: relative;
}

/* Desktop/Tablet View */
.desktop-table {
  display: block;
}

.mobile-cards {
  display: none;
}

/* Enable horizontal scroll on desktop for very wide tables */
.desktop-table :deep(.n-data-table) {
  min-width: 800px;
}

.desktop-table :deep(.n-data-table-wrapper) {
  overflow-x: auto;
}

/* Mobile Loading */
.mobile-loading {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-users {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

/* Mobile Card Layout */
.user-cards-grid {
  display: grid;
  gap: 16px;
  padding: 4px;
}

.user-card {
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.user-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;
}

.user-avatar-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.user-basic-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-email {
  margin: 0;
  font-size: 13px;
  color: var(--text-color-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-card-body {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

.user-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.user-detail .label {
  font-size: 12px;
  color: var(--text-color-3);
  font-weight: 500;
  flex-shrink: 0;
}

.user-detail .value {
  font-size: 13px;
  color: var(--text-color-1);
  text-align: right;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-tag {
  margin-left: 4px;
}

.role-tag:first-child {
  margin-left: 0;
}

.user-card-actions {
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
  display: flex;
  justify-content: flex-end;
}

/* Responsive Breakpoints */
@media (max-width: 1200px) {
  .desktop-table :deep(.n-data-table) {
    font-size: 13px;
  }
  
  .desktop-table :deep(.n-data-table-td),
  .desktop-table :deep(.n-data-table-th) {
    padding: 8px 6px;
  }
}

@media (max-width: 900px) {
  .desktop-table :deep(.n-data-table) {
    font-size: 12px;
  }
  
  .desktop-table :deep(.n-data-table-td),
  .desktop-table :deep(.n-data-table-th) {
    padding: 6px 4px;
  }
  
  .desktop-table :deep(.n-button) {
    padding: 4px 6px;
    font-size: 11px;
  }
}

/* Switch to mobile view */
@media (max-width: 768px) {
  .desktop-table {
    display: none;
  }
  
  .mobile-cards {
    display: block;
  }
  
  .user-cards-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .user-card {
    border-radius: 8px;
  }
  
  .user-card-header {
    margin-bottom: 12px;
  }
  
  .user-avatar-section {
    gap: 8px;
  }
  
  .user-name {
    font-size: 15px;
  }
  
  .user-email {
    font-size: 12px;
  }
  
  .user-card-body {
    gap: 6px;
    margin-bottom: 12px;
  }
  
  .user-detail .label {
    font-size: 11px;
  }
  
  .user-detail .value {
    font-size: 12px;
  }
  
  .user-card-actions {
    padding-top: 8px;
  }
  
  .user-card-actions :deep(.n-button) {
    font-size: 12px;
    padding: 4px 8px;
  }
  
  .user-cards-grid {
    gap: 8px;
    padding: 2px;
  }
}

/* Very small screens */
@media (max-width: 360px) {
  .user-avatar-section :deep(.n-avatar) {
    width: 32px !important;
    height: 32px !important;
  }
  
  .user-name {
    font-size: 14px;
  }
  
  .user-email {
    font-size: 11px;
  }
  
  .user-card-actions :deep(.n-space) {
    flex-direction: column;
    align-items: stretch;
  }
  
  .user-card-actions :deep(.n-button) {
    width: 100%;
    justify-content: center;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .user-card {
    border: 2px solid var(--border-color);
  }
  
  .user-card-actions {
    border-top: 2px solid var(--border-color);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .user-card {
    transition: none;
  }
}

/* Touch device optimizations */
@media (hover: none) and (pointer: coarse) {
  .user-card-actions :deep(.n-button) {
    min-height: 44px;
    padding: 8px 12px;
  }
  
  .user-card {
    padding: 16px;
  }
}

/* Desktop Actions Button Styling */
.desktop-table :deep(.n-data-table-td) .n-button {
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  border-radius: 6px !important;
  font-weight: 500 !important;
  min-height: 32px !important;
  padding: 4px 8px !important;
  font-size: 12px !important;
}

/* Ensure the Actions column has proper width and centering */
.desktop-table :deep(.n-data-table-th):last-child,
.desktop-table :deep(.n-data-table-td):last-child {
  text-align: center !important;
  vertical-align: middle !important;
}

.desktop-table :deep(.n-data-table-td) .n-button.n-button--ghost.n-button--primary-type {
  --n-color: transparent;
  --n-color-hover: rgba(24, 160, 88, 0.08) !important;
  --n-color-pressed: rgba(24, 160, 88, 0.12) !important;
  --n-color-focus: rgba(24, 160, 88, 0.08) !important;
  --n-border-color: rgba(24, 160, 88, 0.3) !important;
  --n-border-color-hover: rgba(24, 160, 88, 0.5) !important;
  --n-border-color-pressed: rgba(24, 160, 88, 0.6) !important;
  --n-border-color-focus: rgba(24, 160, 88, 0.5) !important;
  --n-text-color: rgba(24, 160, 88, 0.9) !important;
  --n-text-color-hover: rgba(24, 160, 88, 1) !important;
  --n-text-color-pressed: rgba(24, 160, 88, 1) !important;
  --n-text-color-focus: rgba(24, 160, 88, 1) !important;
  border: 1px solid rgba(24, 160, 88, 0.3) !important;
}

.desktop-table :deep(.n-data-table-td) .n-button.n-button--ghost.n-button--error-type {
  --n-color: transparent;
  --n-color-hover: rgba(208, 58, 82, 0.08) !important;
  --n-color-pressed: rgba(208, 58, 82, 0.12) !important;
  --n-color-focus: rgba(208, 58, 82, 0.08) !important;
  --n-border-color: rgba(208, 58, 82, 0.3) !important;
  --n-border-color-hover: rgba(208, 58, 82, 0.5) !important;
  --n-border-color-pressed: rgba(208, 58, 82, 0.6) !important;
  --n-border-color-focus: rgba(208, 58, 82, 0.5) !important;
  --n-text-color: rgba(208, 58, 82, 0.9) !important;
  --n-text-color-hover: rgba(208, 58, 82, 1) !important;
  --n-text-color-pressed: rgba(208, 58, 82, 1) !important;
  --n-text-color-focus: rgba(208, 58, 82, 1) !important;
  border: 1px solid rgba(208, 58, 82, 0.3) !important;
}

.desktop-table :deep(.n-data-table-td) .n-button.n-button--ghost.n-button--success-type {
  --n-color: transparent;
  --n-color-hover: rgba(24, 160, 88, 0.08) !important;
  --n-color-pressed: rgba(24, 160, 88, 0.12) !important;
  --n-color-focus: rgba(24, 160, 88, 0.08) !important;
  --n-border-color: rgba(24, 160, 88, 0.3) !important;
  --n-border-color-hover: rgba(24, 160, 88, 0.5) !important;
  --n-border-color-pressed: rgba(24, 160, 88, 0.6) !important;
  --n-border-color-focus: rgba(24, 160, 88, 0.5) !important;
  --n-text-color: rgba(24, 160, 88, 0.9) !important;
  --n-text-color-hover: rgba(24, 160, 88, 1) !important;
  --n-text-color-pressed: rgba(24, 160, 88, 1) !important;
  --n-text-color-focus: rgba(24, 160, 88, 1) !important;
  border: 1px solid rgba(24, 160, 88, 0.3) !important;
}

/* Ensure icons have proper cursor and size */
.desktop-table :deep(.n-data-table-td) .n-button .n-icon {
  cursor: pointer !important;
  font-size: 14px !important;
}

/* Add hover effect for entire button area */
.desktop-table :deep(.n-data-table-td) .n-button:hover {
  transform: translateY(-1px) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

/* Mobile view buttons already have proper styling, just ensure cursor */
.mobile-cards .user-card-actions :deep(.n-button) {
  cursor: pointer !important;
}

.mobile-cards .user-card-actions :deep(.n-button) .n-icon {
  cursor: pointer !important;
}
</style>