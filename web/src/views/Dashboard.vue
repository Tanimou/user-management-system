<template>
  <div class="dashboard-layout">
    <!-- Header -->
    <header class="dashboard-header">
      <nav class="main-nav">
        <div class="nav-brand">User Management</div>
        <div class="nav-items">
          <router-link 
            v-if="isAdmin" 
            to="/users" 
            class="nav-item"
            :class="{ active: $route.path === '/users' }"
          >
            Users
          </router-link>
          <router-link 
            to="/profile" 
            class="nav-item"
            :class="{ active: $route.path === '/profile' }"
          >
            Profile
          </router-link>
        </div>
        <div class="user-menu">
          <div class="user-info">
            <n-avatar 
              :size="32"
              :src="user?.avatarUrl || defaultAvatar" 
              :alt="user?.name"
              round
              class="user-avatar"
            >
              {{ user?.name?.charAt(0)?.toUpperCase() || 'U' }}
            </n-avatar>
            <span class="user-name">{{ user?.name || 'User' }}</span>
            <n-tag 
              :type="user?.roles?.includes('admin') ? 'success' : 'info'"
              size="small"
              class="role-badge"
            >
              {{ user?.roles?.includes('admin') ? 'Admin' : 'User' }}
            </n-tag>
          </div>
          <n-dropdown :options="userMenuOptions" @select="handleUserMenuSelect">
            <n-button text class="logout-btn">
              <template #icon>
                <n-icon><SettingsOutline /></n-icon>
              </template>
            </n-button>
          </n-dropdown>
        </div>
      </nav>
    </header>

    <!-- Main Content -->
    <main class="dashboard-content">
      <!-- Breadcrumb Navigation -->
      <div class="breadcrumb-nav">
        <n-breadcrumb>
          <n-breadcrumb-item>
            <router-link to="/" class="breadcrumb-link">Dashboard</router-link>
          </n-breadcrumb-item>
          <n-breadcrumb-item v-if="$route.path === '/users'">
            Users
          </n-breadcrumb-item>
          <n-breadcrumb-item v-if="$route.path === '/profile'">
            Profile
          </n-breadcrumb-item>
        </n-breadcrumb>
      </div>

      <div class="content-header">
        <h1>{{ pageTitle }}</h1>
        <div class="action-buttons">
          <n-button 
            v-if="isAdmin && ($route.path === '/users' || $route.path === '/demo-admin')" 
            @click="showAddUserModal = true"
            type="primary"
            class="btn-primary"
          >
            <template #icon>
              <n-icon><Add /></n-icon>
            </template>
            Add User
          </n-button>
        </div>
      </div>

      <!-- Admin: User Management Table -->
      <div v-if="isAdmin && ($route.path === '/users' || $route.path === '/demo-admin')" class="user-management">
        <div class="table-controls">
          <n-space>
            <n-input
              v-model:value="searchQuery"
              placeholder="Search users..."
              clearable
              style="width: 250px"
              @input="handleSearch"
            >
              <template #prefix>
                <n-icon><Search /></n-icon>
              </template>
            </n-input>
            
            <n-select
              v-model:value="selectedRole"
              placeholder="Filter by role"
              clearable
              style="width: 150px"
              :options="roleOptions"
              @update:value="handleRoleFilter"
            />
            
            <n-select
              v-model:value="selectedStatus"
              placeholder="Filter by status"
              clearable
              style="width: 150px"
              :options="statusOptions"
              @update:value="handleStatusFilter"
            />
          </n-space>
        </div>

        <user-table
          :users="usersStore.users"
          :loading="usersStore.loading"
          :sorting="{ sortBy: usersStore.sorting.column, sortOrder: usersStore.sorting.direction }"
          @edit="handleEditUser"
          @delete="handleDeleteUser"
          @restore="handleRestoreUser"
          @update:sorter="handleSort"
        />
        
        <pagination-controls
          :current-page="usersStore.pagination.page"
          :page-size="usersStore.pagination.size"
          :total="usersStore.pagination.total"
          :total-pages="usersStore.pagination.totalPages"
          :start-item="(usersStore.pagination.page - 1) * usersStore.pagination.size + 1"
          :end-item="Math.min(usersStore.pagination.page * usersStore.pagination.size, usersStore.pagination.total)"
          :loading="usersStore.loading"
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />
      </div>

      <!-- Regular User: Personal Dashboard -->
      <div v-else class="personal-dashboard">
        <div class="dashboard-cards">
          <div class="card-row">
            <div class="card-col">
              <profile-summary-card 
                :user="user" 
                @edit-profile="handleEditProfile"
              />
            </div>
            <div class="card-col">
              <account-activity-card :user="user" />
            </div>
          </div>
          <div class="card-row">
            <div class="card-col card-col-full">
              <quick-actions-card
                @edit-profile="handleEditProfile"
                @change-password="handleChangePassword"
                @view-activity="handleViewActivity"
                @view-help="handleViewHelp"
                @contact-support="handleContactSupport"
                @view-faq="handleViewFaq"
              />
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Modals -->
    <n-modal 
      v-model:show="showAddUserModal" 
      preset="dialog" 
      title="Create User"
      style="width: 600px"
    >
      <user-form 
        :user="null" 
        @save="handleUserCreated" 
        @cancel="showAddUserModal = false" 
      />
    </n-modal>
    
    <n-modal
      v-model:show="showEditUserModal"
      preset="dialog"
      title="Edit User"
      style="width: 600px"
    >
      <user-form
        :user="editingUser"
        @save="handleUserUpdated"
        @cancel="showEditUserModal = false"
      />
    </n-modal>

    <user-profile 
      v-model:show="showProfileModal" 
      @updated="handleProfileUpdated" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage, useDialog } from 'naive-ui';
import {
  SettingsOutline,
  Add,
  Search,
} from '@vicons/ionicons5';

import { useAuthStore, type User } from '@/stores/auth';
import { useUsersStore } from '@/stores/users';

// Components
import UserTable from '@/components/UserTable.vue';
import UserForm from '@/components/UserForm.vue';
import UserProfile from '@/components/UserProfile.vue';
import PaginationControls from '@/components/PaginationControls.vue';
import ProfileSummaryCard from '@/components/ProfileSummaryCard.vue';
import AccountActivityCard from '@/components/AccountActivityCard.vue';
import QuickActionsCard from '@/components/QuickActionsCard.vue';

// Composables
const route = useRoute();
const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const authStore = useAuthStore();
const usersStore = useUsersStore();

// State
const searchQuery = ref('');
const selectedRole = ref('all');
const selectedStatus = ref('all');
const showAddUserModal = ref(false);
const showEditUserModal = ref(false);
const showProfileModal = ref(false);
const editingUser = ref<User | null>(null);

// Computed
const user = computed(() => authStore.user);
const isAdmin = computed(() => user.value?.roles.includes('admin') ?? false);

const defaultAvatar = computed(() => 
  `https://api.dicebear.com/7.x/initials/svg?seed=${user.value?.name || 'User'}`
);

const pageTitle = computed(() => {
  if (route.path === '/users' && isAdmin.value) return 'User Management';
  if (route.path === '/profile') return 'Profile';
  return 'Dashboard';
});

const roleOptions = [
  { value: 'all', label: 'All Roles' },
  { value: 'user', label: 'Users' },
  { value: 'admin', label: 'Admins' }
];

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

const userMenuOptions = [
  {
    label: 'Profile',
    key: 'profile',
    icon: () => h('n-icon', null, { default: () => h(SettingsOutline) })
  },
  {
    label: 'Logout',
    key: 'logout',
    icon: () => h('n-icon', null, { default: () => h(SettingsOutline) })
  }
];

// Methods - Search and Filters
function handleSearch() {
  usersStore.setSearchQuery(searchQuery.value);
  usersStore.loadUsers();
}

function handleRoleFilter() {
  usersStore.setRoleFilter(selectedRole.value);
  usersStore.loadUsers();
}

function handleStatusFilter() {
  usersStore.setStatusFilter(selectedStatus.value);  
  usersStore.loadUsers();
}

// Methods - User Management
function handleEditUser(user: User) {
  editingUser.value = user;
  showEditUserModal.value = true;
}

function handleDeleteUser(user: User) {
  dialog.warning({
    title: 'Confirm Delete',
    content: `Are you sure you want to deactivate ${user.name}?`,
    positiveText: 'Delete',
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      try {
        await usersStore.deleteUser(user.id);
        message.success('User deactivated successfully');
      } catch (error: any) {
        message.error(error.response?.data?.error || 'Failed to deactivate user');
      }
    },
  });
}

function handleRestoreUser(user: User) {
  dialog.info({
    title: 'Confirm Restore',
    content: `Are you sure you want to restore ${user.name}?`,
    positiveText: 'Restore',
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      try {
        await usersStore.restoreUser(user.id);
        message.success('User restored successfully');
      } catch (error: any) {
        message.error(error.response?.data?.error || 'Failed to restore user');
      }
    },
  });
}

function handleSort(sorterInfo: any) {
  if (!sorterInfo) return;
  const { columnKey, order } = sorterInfo;
  const sortOrder = order === 'ascend' ? 'asc' : 'desc';
  usersStore.setSorting(columnKey, sortOrder);
  usersStore.loadUsers();
}

function handlePageChange(page: number) {
  usersStore.setPage(page);
  usersStore.loadUsers();
}

function handlePageSizeChange(pageSize: number) {
  usersStore.setPageSize(pageSize);
  usersStore.loadUsers();
}

// Methods - User CRUD
async function handleUserCreated(userData: any) {
  try {
    await usersStore.createUser(userData);
    message.success('User created successfully');
    showAddUserModal.value = false;
  } catch (error: any) {
    message.error(error.response?.data?.error || 'Failed to create user');
  }
}

async function handleUserUpdated(userData: any) {
  if (!editingUser.value) return;
  
  try {
    await usersStore.updateUser(editingUser.value.id, userData);
    message.success('User updated successfully');
    showEditUserModal.value = false;
    editingUser.value = null;
  } catch (error: any) {
    message.error(error.response?.data?.error || 'Failed to update user');
  }
}

// Methods - Profile Actions
function handleEditProfile() {
  showProfileModal.value = true;
}

function handleProfileUpdated() {
  message.success('Profile updated successfully');
}

function handleChangePassword() {
  showProfileModal.value = true;
}

// Placeholder methods for quick actions
function handleViewActivity() {
  message.info('Activity view coming soon!');
}

function handleViewHelp() {
  message.info('Help documentation coming soon!');
}

function handleContactSupport() {
  message.info('Support contact coming soon!');
}

function handleViewFaq() {
  message.info('FAQ coming soon!');
}

// Methods - Menu Actions
function handleUserMenuSelect(key: string) {
  if (key === 'profile') {
    router.push('/profile');
  } else if (key === 'logout') {
    authStore.logout();
    router.push('/login');
  }
}

// Watchers & Lifecycle
watch(() => route.path, () => {
  // Load users when navigating to users page
  if (route.path === '/users' && isAdmin.value) {
    usersStore.loadUsers();
  }
});

onMounted(() => {
  // Handle demo mode
  if (route.meta.demo) {
    const demoUser: User = route.meta.demo === 'admin' 
      ? {
          id: 2,
          name: 'Admin Demo',
          email: 'admin@demo.com',
          roles: ['admin', 'user'],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      : {
          id: 1,
          name: 'User Demo',
          email: 'user@demo.com',
          roles: ['user'],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
    
    localStorage.setItem('accessToken', 'demo-token');
    authStore.setDemoUser(demoUser);
  }

  // Load users if on users page and user is admin
  if ((route.path === '/users' || route.path === '/demo-admin') && isAdmin.value) {
    usersStore.loadUsers();
  }
});
</script>

<style scoped>
.dashboard-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

/* Header Styles */
.dashboard-header {
  background: white;
  border-bottom: 1px solid #e0e0e6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.main-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 64px;
  max-width: 1400px;
  margin: 0 auto;
}

.nav-brand {
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.nav-items {
  display: flex;
  gap: 32px;
}

.nav-item {
  text-decoration: none;
  color: #666;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 6px;
  transition: all 0.2s;
}

.nav-item:hover {
  color: #2080f0;
  background: #f0f4ff;
}

.nav-item.active {
  color: #2080f0;
  background: #f0f4ff;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
}

.user-name {
  font-weight: 500;
  color: #333;
}

.role-badge {
  flex-shrink: 0;
}

.logout-btn {
  color: #666;
}

/* Content Styles */
.dashboard-content {
  flex: 1;
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.breadcrumb-nav {
  margin-bottom: 24px;
}

.breadcrumb-link {
  text-decoration: none;
  color: inherit;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.content-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  color: #333;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

/* User Management Styles */
.user-management {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.table-controls {
  margin-bottom: 24px;
}

/* Personal Dashboard Styles */
.personal-dashboard {
  flex: 1;
}

.dashboard-cards {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card-row {
  display: flex;
  gap: 24px;
}

.card-col {
  flex: 1;
  min-width: 0;
}

.card-col-full {
  flex: none;
  width: 100%;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .main-nav {
    padding: 0 16px;
  }
  
  .dashboard-content {
    padding: 16px;
  }
  
  .card-row {
    flex-direction: column;
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .main-nav {
    flex-wrap: wrap;
    height: auto;
    padding: 12px 16px;
    gap: 12px;
  }
  
  .nav-items {
    order: 3;
    width: 100%;
    justify-content: center;
    gap: 16px;
  }
  
  .user-info .user-name {
    display: none;
  }
  
  .content-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .content-header h1 {
    font-size: 24px;
  }
  
  .dashboard-content {
    padding: 12px;
  }
  
  .user-management {
    padding: 16px;
  }
  
  .table-controls :deep(.n-space) {
    flex-direction: column;
    align-items: stretch;
  }
  
  .table-controls :deep(.n-space .n-space-item) {
    margin-right: 0 !important;
    margin-bottom: 8px;
  }
  
  .table-controls :deep(.n-input),
  .table-controls :deep(.n-select) {
    width: 100% !important;
  }
}

@media (max-width: 480px) {
  .nav-brand {
    font-size: 18px;
  }
  
  .main-nav {
    padding: 8px 12px;
  }
  
  .dashboard-content {
    padding: 8px;
  }
  
  .content-header h1 {
    font-size: 20px;
  }
  
  .user-management {
    padding: 12px;
  }
  
  .dashboard-cards {
    gap: 16px;
  }
}
</style>