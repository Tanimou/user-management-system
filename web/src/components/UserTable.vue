<template>
  <n-card>
    <n-data-table
      :columns="columns"
      :data="users"
      :loading="loading"
      :pagination="false"
      :bordered="false"
      @update:sorter="handleSorterChange"
    />
  </n-card>
</template>

<script setup lang="ts">
import { computed, h } from 'vue';
import { type DataTableColumns } from 'naive-ui';
import { 
  Create as EditIcon,
  Trash as DeleteIcon
} from '@vicons/ionicons5';
import { useAuthStore, type User } from '@/stores/auth';

interface Props {
  users: User[];
  loading: boolean;
  sorting: {
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
}

interface Emits {
  (e: 'update:sorter', sorterInfo: any): void;
  (e: 'edit', user: User): void;
  (e: 'delete', user: User): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const authStore = useAuthStore();

// Remove pagination reactive computed since pagination is now handled separately
// const paginationReactive = computed(() => ({...})); // REMOVED

// Table columns
const columns: DataTableColumns<User> = [
  { title: 'ID', key: 'id', width: 80 },
  { 
    title: 'Name', 
    key: 'name',
    sorter: true,
    sortOrder: props.sorting.sortBy === 'name' ? (props.sorting.sortOrder === 'asc' ? 'ascend' : 'descend') : false
  },
  { 
    title: 'Email', 
    key: 'email',
    sorter: true,
    sortOrder: props.sorting.sortBy === 'email' ? (props.sorting.sortOrder === 'asc' ? 'ascend' : 'descend') : false
  },
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
    sorter: true,
    sortOrder: props.sorting.sortBy === 'createdAt' ? (props.sorting.sortOrder === 'asc' ? 'ascend' : 'descend') : false,
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
</script>

<style scoped>
/* UserTable responsive design */
:deep(.n-data-table) {
  /* Enable horizontal scroll on mobile */
  min-width: 600px;
}

:deep(.n-data-table-wrapper) {
  overflow-x: auto;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  :deep(.n-data-table) {
    font-size: 12px;
  }
  
  :deep(.n-data-table-td) {
    padding: 8px 4px;
  }
  
  :deep(.n-data-table-th) {
    padding: 8px 4px;
  }
  
  :deep(.n-button) {
    padding: 4px 8px;
  }
}

@media (max-width: 480px) {
  :deep(.n-data-table) {
    font-size: 11px;
  }
  
  :deep(.n-data-table-td) {
    padding: 6px 2px;
  }
  
  :deep(.n-data-table-th) {
    padding: 6px 2px;
  }
}
</style>