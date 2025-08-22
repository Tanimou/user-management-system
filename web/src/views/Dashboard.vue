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
          <div class="header-actions">
            <n-tabs 
              v-model:value="activeTab" 
              type="segment" 
              @update:value="handleTabChange"
              style="margin-right: 16px"
            >
              <n-tab-pane name="active" tab="Active Users" />
              <n-tab-pane name="deactivated" tab="Deactivated Users" v-if="authStore.isAdmin" />
            </n-tabs>
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
        </div>

        <!-- Filters -->

        <n-card class="filters-card" v-if="activeTab === 'active'">
          <n-space>

            <n-input
              v-model:value="filters.search"
              placeholder="Search by name or email..."
              clearable
              style="width: 250px"
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

            <n-select
              v-model:value="filters.role"
              placeholder="Role"
              clearable
              style="width: 120px"
              :options="roleOptions"
            />

            <n-date-picker
              v-model:value="filters.createdFrom"
              type="date"
              placeholder="From Date"
              clearable
              style="width: 150px"
            />

            <n-date-picker
              v-model:value="filters.createdTo"
              type="date"
              placeholder="To Date"
              clearable
              style="width: 150px"
            />

            <n-button @click="clearFilters" secondary>
              Clear Filters
            </n-button>

            <n-button @click="loadUsers">
              <template #icon>
                <n-icon><RefreshIcon /></n-icon>
              </template>
              Refresh
            </n-button>
          </n-space>
          
          <!-- Active Filters Indicator -->
          <div v-if="activeFiltersCount > 0" class="active-filters-indicator">
            <n-text depth="3" style="font-size: 12px;">
              {{ activeFiltersCount }} filter{{ activeFiltersCount > 1 ? 's' : '' }} active
            </n-text>
          </div>
        </n-card>

        <!-- Deactivated Users Filters -->
        <n-card class="filters-card" v-else-if="activeTab === 'deactivated'">
          <n-space>
            <n-input
              v-model:value="filters.search"
              placeholder="Search deactivated users..."
              clearable
              @input="debouncedSearch"
            >
              <template #prefix>
                <n-icon><SearchIcon /></n-icon>
              </template>
            </n-input>

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

          :pagination="pagination"
          :sorting="sorting"
          :show-deleted-column="activeTab === 'deactivated'"
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"

          @update:sorter="handleSorterChange"
          @edit="handleEdit"
          @delete="handleDelete"
          @restore="handleRestore"
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
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
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
import { fromNaiveSortOrder } from '@/utils/sorting';
import apiClient from '@/api/axios';

const router = useRouter();
const route = useRoute();
const message = useMessage();
const dialog = useDialog();
const authStore = useAuthStore();
const sorting = reactive({
  sortBy: 'createdAt',
  sortOrder: 'desc'
});
// Computed
const activeFiltersCount = computed(() => {
  let count = 0;
  if (filters.search) count++;
  if (filters.active !== undefined) count++;
  if (filters.role) count++;
  if (filters.createdFrom) count++;
  if (filters.createdTo) count++;
  return count;
});

// State
const users = ref<User[]>([]);
const loading = ref(false);
const showCreateModal = ref(false);
const showEditModal = ref(false);
const showProfileModal = ref(false);
const editingUser = ref<User | null>(null);
const activeTab = ref<'active' | 'deactivated'>('active');

// Derived state for pagination display
const total = ref(0);
const totalPages = ref(1);
const startItem = ref(0);
const endItem = ref(0);
const paginationState = usePaginationState();
// Legacy filters - sync with pagination state
const filters = reactive({
  search: '',
  active: undefined as boolean | undefined,
  role: '' as string,
  createdFrom: null as string | null,
  createdTo: null as string | null,
});

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
});

// Remove old pagination/sorting state as it's now handled by paginationState
// const pagination = reactive({...});  // REMOVED
// const sorting = reactive({...});     // REMOVED

// Options
const statusOptions = [
  { label: 'Active', value: true },
  { label: 'Inactive', value: false },
];

const roleOptions = [
  { label: 'User', value: 'user' },
  { label: 'Admin', value: 'admin' },
];

const userMenuOptions = [
  { label: 'Profile', key: 'profile' },
  { label: 'Logout', key: 'logout' },
];

// Debounced search with reduced timeout for better UX
let searchTimeout: NodeJS.Timeout;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    // The search change will be handled by the watcher automatically
    loadUsers();
  }, 300); // Reduced from 500ms for faster response
};

// Load users with enhanced pagination state
async function loadUsers() {
  loading.value = true;
  try {
    const params: any = {
      page: paginationState.page.value,
size: paginationState.size.value,
orderBy: paginationState.sortBy.value,
order: paginationState.sortOrder.value,
    };

    if (filters.search) {
      params.search = filters.search;
    }

    let endpoint = '/users';
    
    if (activeTab.value === 'deactivated') {
      endpoint = '/users/deactivated';
      // For deactivated users, default sort by deletedAt desc
      if (!params.sortBy || params.sortBy === 'createdAt') {
        params.sortBy = 'deletedAt';
        params.sortOrder = 'desc';
        sorting.sortBy = 'deletedAt';
        sorting.sortOrder = 'desc';
      }
    } else {
      // For active users, apply active filter if set
      if (filters.active !== undefined) {
        params.active = filters.active;
      }
    }


    const response = await apiClient.get(endpoint, { params });

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
  const sortOrder = fromNaiveSortOrder(order);
  
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

function handleRestore(user: User) {
  dialog.info({
    title: 'Confirm Restore',
    content: `Are you sure you want to restore user "${user.name}"?`,
    positiveText: 'Restore',
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      try {
        await apiClient.post(`/users/${user.id}`, { action: 'restore' });
        message.success('User restored successfully');
        loadUsers();
      } catch (error: any) {
        message.error(error.response?.data?.error || 'Failed to restore user');
      }
    },
  });
}

function handleTabChange(value: 'active' | 'deactivated') {
  activeTab.value = value;
  // Reset filters when switching tabs
  filters.search = '';
  filters.active = undefined;
  pagination.page = 1;
  
  // Reset sorting for deactivated tab
  if (value === 'deactivated') {
    sorting.sortBy = 'deletedAt';
    sorting.sortOrder = 'desc';
  } else {
    sorting.sortBy = 'createdAt';
    sorting.sortOrder = 'desc';
  }
  
  loadUsers();
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

// Initialize filters from URL parameters
function initializeFromURL() {
  const query = route.query;
  
  if (query.search) {
    filters.search = query.search as string;
  }
  
  if (query.active !== undefined) {
    filters.active = query.active === 'true' ? true : query.active === 'false' ? false : undefined;
  }
  
  if (query.role) {
    filters.role = query.role as string;
  }
  
if (query.orderBy) {
  paginationState.setSorting(query.orderBy as string, (query.order as 'asc' | 'desc') || 'asc');
}  

if (query.page) {
  paginationState.setPage(parseInt(query.page as string) || 1);
}

if (query.size) {
  paginationState.setSize(parseInt(query.size as string) || 10);
}

  // Handle date filters (from timestamp to Date object)
  if (query.createdFrom) {
    filters.createdFrom = new Date(query.createdFrom as string).toISOString();
  }

  if (query.createdTo) {
    filters.createdTo = new Date(query.createdTo as string).toISOString();
  }
}

// Clear all filters
function clearFilters() {
  filters.search = '';
  filters.active = undefined;
  filters.role = '';
  filters.createdFrom = null;
  filters.createdTo = null;
  paginationState.setPage(1);
  loadUsers();
}

// Watch filters
watch(() => filters.active, () => {
  paginationState.setPage(1);
  loadUsers();
});

watch(() => filters.role, () => {
  paginationState.setPage(1);
  loadUsers();
});

watch(() => filters.createdFrom, () => {
  paginationState.setPage(1);
  loadUsers();
});

watch(() => filters.createdTo, () => {
  paginationState.setPage(1);
  loadUsers();
});

// Initialize
onMounted(() => {
  initializeFromURL();
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.filters-card {
  margin-bottom: 24px;
}

.active-filters-indicator {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

/* Responsive Design */
@media (max-width: 768px) {
  .filters-card :deep(.n-space) {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filters-card :deep(.n-space .n-space-item) {
    margin-right: 0 !important;
    margin-bottom: 8px;
  }
  
  .filters-card :deep(.n-input),
  .filters-card :deep(.n-select),
  .filters-card :deep(.n-date-picker) {
    width: 100% !important;
  }

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
  
  .header-actions {
    width: 100%;
    flex-direction: column;
    gap: 12px;
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