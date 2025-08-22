<template>
  <div class="pagination-container">
    <!-- Pagination Info -->
    <div class="pagination-info">
      <n-text v-if="total === 0" depth="3">No users found</n-text>
      <n-text v-else depth="3">
        {{ startItem }}-{{ endItem }} of {{ total }} users
      </n-text>
    </div>

    <!-- Pagination Controls -->
    <div class="pagination-controls" @keydown="handleKeyboardNavigation">
      <!-- First Page -->
      <n-button 
        size="small" 
        :disabled="currentPage === 1 || loading"
        @click="goToPage(1)"
        title="First page (Ctrl+Home)"
      >
        <template #icon>
          <n-icon><ChevronDoubleLeftIcon /></n-icon>
        </template>
      </n-button>

      <!-- Previous Page -->
      <n-button 
        size="small" 
        :disabled="currentPage === 1 || loading"
        @click="goToPage(currentPage - 1)"
        title="Previous page (Ctrl+Left)"
      >
        <template #icon>
          <n-icon><ChevronLeftIcon /></n-icon>
        </template>
      </n-button>

      <!-- Page Numbers -->
      <div class="page-numbers" v-if="totalPages > 1">
        <n-button 
          v-for="page in visiblePages" 
          :key="page"
          size="small"
          :type="page === currentPage ? 'primary' : 'default'"
          :ghost="page !== currentPage"
          @click="goToPage(page)"
          :disabled="loading"
          :title="`Page ${page}${page === currentPage ? ' (current)' : ''}`"
        >
          {{ page }}
        </n-button>
      </div>

      <!-- Next Page -->
      <n-button 
        size="small" 
        :disabled="currentPage === totalPages || loading"
        @click="goToPage(currentPage + 1)"
        title="Next page (Ctrl+Right)"
      >
        <template #icon>
          <n-icon><ChevronRightIcon /></n-icon>
        </template>
      </n-button>

      <!-- Last Page -->
      <n-button 
        size="small" 
        :disabled="currentPage === totalPages || loading"
        @click="goToPage(totalPages)"
        title="Last page (Ctrl+End)"
      >
        <template #icon>
          <n-icon><ChevronDoubleRightIcon /></n-icon>
        </template>
      </n-button>
    </div>

    <!-- Page Size Selector -->
    <div class="page-size-selector">
      <n-text depth="3">Show:</n-text>
      <n-select 
        v-model:value="pageSizeModel" 
        size="small"
        style="width: 80px"
        :options="pageSizeOptions"
        :disabled="loading"
        @update:value="handlePageSizeChange"
      />
      <n-text depth="3">per page</n-text>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import {
  ChevronBackOutline as ChevronLeftIcon,
  ChevronForwardOutline as ChevronRightIcon,
  PlayBackOutline as ChevronDoubleLeftIcon,
  PlayForwardOutline as ChevronDoubleRightIcon,
} from '@vicons/ionicons5';

interface Props {
  currentPage: number;
  pageSize: number;
  total: number;
  totalPages: number;
  startItem?: number;
  endItem?: number;
  loading?: boolean;
  pageSizeOptions?: Array<{ label: string; value: number }>;
}

interface Emits {
  (e: 'update:page', page: number): void;
  (e: 'update:page-size', pageSize: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  startItem: 0,
  endItem: 0,
  pageSizeOptions: () => [
    { label: '10', value: 10 },
    { label: '25', value: 25 },
    { label: '50', value: 50 },
  ]
});

const emit = defineEmits<Emits>();

const pageSizeModel = ref(props.pageSize);

// Update model when prop changes
watch(() => props.pageSize, (newValue) => {
  pageSizeModel.value = newValue;
});

// Calculate visible page numbers for pagination
const visiblePages = computed(() => {
  const pages: number[] = [];
  const maxVisiblePages = 7;
  const halfVisible = Math.floor(maxVisiblePages / 2);
  
  let startPage = Math.max(1, props.currentPage - halfVisible);
  let endPage = Math.min(props.totalPages, startPage + maxVisiblePages - 1);
  
  // Adjust start if we're near the end
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  return pages;
});

function goToPage(page: number) {
  if (page >= 1 && page <= props.totalPages && page !== props.currentPage && !props.loading) {
    emit('update:page', page);
  }
}

function handlePageSizeChange(newPageSize: number) {
  emit('update:page-size', newPageSize);
}

function handleKeyboardNavigation(event: KeyboardEvent) {
  if (!event.ctrlKey) return;
  
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      goToPage(props.currentPage - 1);
      break;
    case 'ArrowRight':
      event.preventDefault();
      goToPage(props.currentPage + 1);
      break;
    case 'Home':
      event.preventDefault();
      goToPage(1);
      break;
    case 'End':
      event.preventDefault();
      goToPage(props.totalPages);
      break;
  }
}

// Global keyboard navigation
function handleGlobalKeyboard(event: KeyboardEvent) {
  // Only handle if target is not an input field
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
    return;
  }
  
  handleKeyboardNavigation(event);
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeyboard);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyboard);
});
</script>

<style scoped>
.pagination-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  flex-wrap: wrap;
  background: var(--n-card-color);
  border-radius: var(--n-border-radius);
  border: 1px solid var(--n-border-color);
}

.pagination-info {
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  justify-content: center;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 0 8px;
}

.page-size-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .pagination-container {
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }
  
  .pagination-info {
    order: 3;
    font-size: 12px;
  }
  
  .pagination-controls {
    order: 1;
    justify-content: center;
  }
  
  .page-size-selector {
    order: 2;
    font-size: 12px;
  }
  
  .page-numbers {
    margin: 0 4px;
  }
}

@media (max-width: 480px) {
  .pagination-container {
    padding: 8px;
  }
  
  .pagination-controls {
    gap: 2px;
  }
  
  .page-numbers {
    gap: 1px;
    margin: 0 2px;
  }
  
  .page-size-selector .n-select {
    width: 60px !important;
  }
}

/* Accessibility improvements */
.pagination-controls:focus-within {
  outline: 2px solid var(--n-primary-color);
  outline-offset: 2px;
  border-radius: 4px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .pagination-container {
    border-width: 2px;
  }
  
  .page-numbers .n-button[type="primary"] {
    font-weight: bold;
  }
}
</style>