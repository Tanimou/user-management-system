<template>
  <div class="dashboard-container">
    <!-- Header -->
    <n-layout-header class="header">
      <div class="header-content">
        <h1>User Management System</h1>
        <div class="user-menu">
          <n-dropdown :options="userMenuOptions" @select="handleUserMenuSelect">
            <n-button text>
              <n-icon><PersonIcon /></n-icon>
              {{ authStore.user?.name || 'User' }}
            </n-button>
          </n-dropdown>
        </div>
      </div>
    </n-layout-header>

    <!-- Main Content -->
    <n-layout class="main-layout">
      <n-layout-content class="content">
        <!-- Page Header -->
        <div class="page-header">
          <h2>Users</h2>
          <n-button
            v-if="authStore.isAdmin"
            type="primary"
            @click="showCreateModal = true"
          >
            <template #icon>
              <n-icon><AddIcon /></n-icon>
            </template>
            Create User
          </n-button>
        </div>

        <!-- Filters -->
        <n-card class="filters-card">
          <n-space>
            <n-input
              v-model:value="filters.search"
              placeholder="Search by name or email..."
              clearable
              @input="debouncedSearch"
            >
              <template #prefix>
                <n-icon><SearchIcon /></n-icon>
              </template>
            </n-input>

            <n-select
              v-model:value="filters.active"
              placeholder="Status"
              clearable
              style="width: 120px"
              :options="statusOptions"
            />

            <n-button @click="loadUsers">
              <template #icon>
                <n-icon><RefreshIcon /></n-icon>
              </template>
              Refresh
            </n-button>
          </n-space>
        </n-card>

        <!-- Users Table -->
        <user-table
          :users="users"
          :loading="loading"
          :sorting="{ sortBy: paginationState.sortBy.value, sortOrder: paginationState.sortOrder.value }"
          @update:sorter="handleSorterChange"
          @edit="handleEdit"
          @delete="handleDelete"
        />

        <!-- Enhanced Pagination Controls -->
        <pagination-controls
          :current-page="paginationState.page.value"
          :page-size="paginationState.size.value"
          :total="total"
          :total-pages="totalPages"
          :start-item="startItem"
          :end-item="endItem"
          :loading="loading"
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />

        <!-- Create/Edit User Modal -->
        <n-modal v-model:show="showCreateModal" preset="dialog" title="Create User">
          <user-form
            :user="editingUser"
            @save="handleSaveUser"
            @cancel="handleCancelUser"
          />
        </n-modal>

        <n-modal v-model:show="showEditModal" preset="dialog" title="Edit User">
          <user-form
            :user="editingUser"
            @save="handleSaveUser"
            @cancel="handleCancelUser"
          />
        </n-modal>

        <!-- User Profile Modal -->
        <user-profile 
          v-model:show="showProfileModal"
          @updated="handleProfileUpdated"
        />
      </n-layout-content>
    </n-layout>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage, useDialog } from 'naive-ui';
import { 
  PersonOutline as PersonIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon
} from '@vicons/ionicons5';
import { useAuthStore, type User } from '@/stores/auth';
import UserForm from '@/components/UserForm.vue';
import UserProfile from '@/components/UserProfile.vue';
import UserTable from '@/components/UserTable.vue';
import PaginationControls from '@/components/PaginationControls.vue';
import { usePaginationState } from '@/composables/usePaginationState';
import apiClient from '@/api/axios';

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const authStore = useAuthStore();

// Enhanced pagination state with URL management
const paginationState = usePaginationState({
  defaultPage: 1,
  defaultSize: 10,
  defaultSortBy: 'createdAt',
  defaultSortOrder: 'desc',
});

// State
const users = ref<User[]>([]);
const loading = ref(false);
const showCreateModal = ref(false);
const showEditModal = ref(false);
const showProfileModal = ref(false);
const editingUser = ref<User | null>(null);

// Derived state for pagination display
const total = ref(0);
const totalPages = ref(1);
const startItem = ref(0);
const endItem = ref(0);

// Legacy filters - sync with pagination state
const filters = reactive({
  search: paginationState.search.value,
  active: paginationState.active.value,
});

// Watch for changes in pagination state and update filters
watch(() => paginationState.search.value, (newSearch) => {
  filters.search = newSearch;
});

watch(() => paginationState.active.value, (newActive) => {
  filters.active = newActive;
});

// Watch for changes in filters and update pagination state
watch(() => filters.search, (newSearch) => {
  paginationState.setSearch(newSearch);
});

watch(() => filters.active, (newActive) => {
  paginationState.setActive(newActive);
});

// Remove old pagination/sorting state as it's now handled by paginationState
// const pagination = reactive({...});  // REMOVED
// const sorting = reactive({...});     // REMOVED

// Options
const statusOptions = [
  { label: 'Active', value: true },
  { label: 'Inactive', value: false },
];

const userMenuOptions = [
  { label: 'Profile', key: 'profile' },
  { label: 'Logout', key: 'logout' },
];

// Debounced search
let searchTimeout: NodeJS.Timeout;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    // The search change will be handled by the watcher automatically
    loadUsers();
  }, 500);
};

// Load users with enhanced pagination state
async function loadUsers() {
  loading.value = true;
  try {
    const params = paginationState.getApiParams();
    const response = await apiClient.get('/users', { params });
    
    users.value = response.data.data;
    total.value = response.data.pagination.total;
    totalPages.value = response.data.pagination.totalPages;
    startItem.value = response.data.pagination.startItem || 0;
    endItem.value = response.data.pagination.endItem || 0;
  } catch (error: any) {
    message.error(error.response?.data?.error || 'Failed to load users');
  } finally {
    loading.value = false;
  }
}

function handlePageChange(page: number) {
  paginationState.setPage(page);
  loadUsers();
}

function handlePageSizeChange(pageSize: number) {
  paginationState.setSize(pageSize);
  loadUsers();
}

function handleSorterChange(sorterInfo: any) {
  if (!sorterInfo) return;
  
  const { columnKey, order } = sorterInfo;
  const sortBy = columnKey;
  const sortOrder = order === 'ascend' ? 'asc' : 'desc';
  
  paginationState.setSorting(sortBy, sortOrder);
  loadUsers();
}

function handleEdit(user: User) {
  editingUser.value = user;
  showEditModal.value = true;
}

function handleDelete(user: User) {
  dialog.warning({
    title: 'Confirm Delete',
    content: `Are you sure you want to delete user "${user.name}"?`,
    positiveText: 'Delete',
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      try {
        await apiClient.delete(`/users/${user.id}`);
        message.success('User deleted successfully');
        loadUsers();
      } catch (error: any) {
        message.error(error.response?.data?.error || 'Failed to delete user');
      }
    },
  });
}

async function handleSaveUser(userData: any) {
  try {
    if (editingUser.value) {
      // Update existing user
      await apiClient.put(`/users/${editingUser.value.id}`, userData);
      message.success('User updated successfully');
    } else {
      // Create new user
      await apiClient.post('/users', userData);
      message.success('User created successfully');
    }
    
    showCreateModal.value = false;
    showEditModal.value = false;
    editingUser.value = null;
    loadUsers();
  } catch (error: any) {
    message.error(error.response?.data?.error || 'Failed to save user');
  }
}

function handleCancelUser() {
  showCreateModal.value = false;
  showEditModal.value = false;
  editingUser.value = null;
}

function handleUserMenuSelect(key: string) {
  if (key === 'logout') {
    authStore.logout();
    router.push('/login');
  } else if (key === 'profile') {
    showProfileModal.value = true;
  }
}

function handleProfileUpdated() {
  // Profile was updated successfully, no need to reload users list
  // The auth store is automatically updated
}

// Watch filters
import { watch } from 'vue';
watch(() => filters.active, () => {
  pagination.page = 1;
  loadUsers();
});

// Initialize
onMounted(() => {
  loadUsers();
});
</script>

<style scoped>
.dashboard-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  border-bottom: 1px solid #e0e0e6;
  padding: 0 24px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
}

.header-content h1 {
  margin: 0;
  color: #333;
  font-size: 20px;
  font-weight: 600;
}

.main-layout {
  flex: 1;
  background: #f5f5f5;
}

.content {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  color: #333;
  font-size: 24px;
  font-weight: 600;
}

.filters-card {
  margin-bottom: 24px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-content {
    padding: 0 16px;
    height: 56px;
  }
  
  .header-content h1 {
    font-size: 18px;
  }
  
  .content {
    padding: 16px;
  }
  
  .page-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  
  .page-header h2 {
    font-size: 20px;
  }
  
  .filters-card {
    margin-bottom: 16px;
  }
  
  .filters-card :deep(.n-card__content) {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .header-content h1 {
    font-size: 16px;
  }
  
  .content {
    padding: 12px;
  }
  
  .page-header h2 {
    font-size: 18px;
  }
  
  .filters-card :deep(.n-card__content) {
    padding: 12px;
  }
}
</style>