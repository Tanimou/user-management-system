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
        <n-card>
          <n-data-table
            :columns="columns"
            :data="users"
            :loading="loading"
            :pagination="paginationReactive"
            :bordered="false"
            @update:page="handlePageChange"
            @update:page-size="handlePageSizeChange"
          />
        </n-card>

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
      </n-layout-content>
    </n-layout>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, h, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage, useDialog, type DataTableColumns } from 'naive-ui';
import { 
  PersonOutline as PersonIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Create as EditIcon,
  Trash as DeleteIcon
} from '@vicons/ionicons5';
import { useAuthStore, type User } from '@/stores/auth';
import UserForm from '@/components/UserForm.vue';
import apiClient from '@/api/axios';

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const authStore = useAuthStore();

// State
const users = ref<User[]>([]);
const loading = ref(false);
const showCreateModal = ref(false);
const showEditModal = ref(false);
const editingUser = ref<User | null>(null);

const filters = reactive({
  search: '',
  active: undefined as boolean | undefined,
});

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
});

const paginationReactive = computed(() => ({
  ...pagination,
  onChange: (page: number) => handlePageChange(page),
  onUpdatePageSize: (pageSize: number) => handlePageSizeChange(pageSize),
}));

// Options
const statusOptions = [
  { label: 'Active', value: true },
  { label: 'Inactive', value: false },
];

const userMenuOptions = [
  { label: 'Profile', key: 'profile' },
  { label: 'Logout', key: 'logout' },
];

// Table columns
const columns: DataTableColumns<User> = [
  { title: 'ID', key: 'id', width: 80 },
  { title: 'Name', key: 'name' },
  { title: 'Email', key: 'email' },
  {
    title: 'Roles',
    key: 'roles',
    render: (row) => h('span', row.roles.join(', ')),
  },
  {
    title: 'Status',
    key: 'isActive',
    render: (row) => h(
      'n-tag',
      { type: row.isActive ? 'success' : 'error' },
      { default: () => row.isActive ? 'Active' : 'Inactive' }
    ),
  },
  {
    title: 'Created',
    key: 'createdAt',
    render: (row) => new Date(row.createdAt).toLocaleDateString(),
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 120,
    render: (row) => h('div', { style: 'display: flex; gap: 8px;' }, [
      h('n-button', {
        size: 'small',
        type: 'primary',
        ghost: true,
        onClick: () => handleEdit(row),
      }, { default: () => h('n-icon', null, { default: () => h(EditIcon) }) }),
      
      authStore.isAdmin && row.id !== authStore.user?.id ? h('n-button', {
        size: 'small',
        type: 'error',
        ghost: true,
        onClick: () => handleDelete(row),
      }, { default: () => h('n-icon', null, { default: () => h(DeleteIcon) }) }) : null,
    ]),
  },
];

// Debounced search
let searchTimeout: NodeJS.Timeout;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    pagination.page = 1;
    loadUsers();
  }, 500);
};

// Methods
async function loadUsers() {
  loading.value = true;
  try {
    const params: any = {
      page: pagination.page,
      size: pagination.pageSize,
    };

    if (filters.search) {
      params.search = filters.search;
    }

    if (filters.active !== undefined) {
      params.active = filters.active;
    }

    const response = await apiClient.get('/users', { params });
    users.value = response.data.data;
    pagination.total = response.data.pagination.total;
  } catch (error: any) {
    message.error(error.response?.data?.error || 'Failed to load users');
  } finally {
    loading.value = false;
  }
}

function handlePageChange(page: number) {
  pagination.page = page;
  loadUsers();
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize;
  pagination.page = 1;
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
    // TODO: Implement profile modal
    message.info('Profile editing coming soon');
  }
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
</style>