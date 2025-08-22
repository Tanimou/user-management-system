import { ref, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { DEFAULT_SORT_BY, DEFAULT_SORT_ORDER } from '@/utils/sorting';

interface PaginationState {
  page: number;
  size: number;
  search: string;
  active: boolean | undefined;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface PaginationStateOptions {
  defaultPage?: number;
  defaultSize?: number;
  defaultSearch?: string;
  defaultActive?: boolean | undefined;
  defaultSortBy?: string;
  defaultSortOrder?: 'asc' | 'desc';
}

export function usePaginationState(options: PaginationStateOptions = {}) {
  const router = useRouter();
  const route = useRoute();

  const {
    defaultPage = 1,
    defaultSize = 10,
    defaultSearch = '',
    defaultActive = undefined,
    defaultSortBy = DEFAULT_SORT_BY,
    defaultSortOrder = DEFAULT_SORT_ORDER,
  } = options;

  // Reactive state
  const page = ref(defaultPage);
  const size = ref(defaultSize);
  const search = ref(defaultSearch);
  const active = ref(defaultActive);
  const sortBy = ref(defaultSortBy);
  const sortOrder = ref(defaultSortOrder);

  // Initialize from URL params
  function initializeFromUrl() {
    const urlPage = parseInt(route.query.page as string) || defaultPage;
    const urlSize = parseInt(route.query.size as string) || defaultSize;
    const urlSearch = (route.query.search as string) || defaultSearch;
    const urlActive = route.query.active !== undefined 
      ? route.query.active === 'true' 
      : defaultActive;
    const urlSortBy = (route.query.sortBy as string) || defaultSortBy;
    const urlSortOrder = (route.query.sortOrder as 'asc' | 'desc') || defaultSortOrder;

    page.value = Math.max(1, urlPage);
    size.value = Math.min(50, Math.max(1, urlSize));
    search.value = urlSearch;
    active.value = urlActive;
    sortBy.value = urlSortBy;
    sortOrder.value = urlSortOrder;
  }

  // Update URL without navigation
  function updateUrl() {
    const query: Record<string, any> = {};

    // Only add non-default values to keep URL clean
    if (page.value !== defaultPage) {
      query.page = page.value.toString();
    }
    if (size.value !== defaultSize) {
      query.size = size.value.toString();
    }
    if (search.value !== defaultSearch) {
      query.search = search.value;
    }
    if (active.value !== defaultActive) {
      query.active = active.value?.toString();
    }
    if (sortBy.value !== defaultSortBy) {
      query.sortBy = sortBy.value;
    }
    if (sortOrder.value !== defaultSortOrder) {
      query.sortOrder = sortOrder.value;
    }

    // Update URL without causing navigation
    router.replace({ query }).catch(() => {
      // Ignore navigation errors (e.g., duplicate navigation)
    });
  }

  // Watch for changes and update URL
  watch([page, size, search, active, sortBy, sortOrder], () => {
    updateUrl();
  }, { deep: true });

  // Functions to update state
  function setPage(newPage: number) {
    page.value = Math.max(1, newPage);
  }

  function setSize(newSize: number) {
    const validSize = Math.min(50, Math.max(1, newSize));
    if (validSize !== size.value) {
      size.value = validSize;
      // Reset to first page when page size changes
      page.value = 1;
    }
  }

  function setSearch(newSearch: string) {
    if (newSearch !== search.value) {
      search.value = newSearch;
      // Reset to first page when search changes
      page.value = 1;
    }
  }

  function setActive(newActive: boolean | undefined) {
    if (newActive !== active.value) {
      active.value = newActive;
      // Reset to first page when filter changes
      page.value = 1;
    }
  }

  function setSorting(newSortBy: string, newSortOrder: 'asc' | 'desc') {
    if (newSortBy !== sortBy.value || newSortOrder !== sortOrder.value) {
      sortBy.value = newSortBy;
      sortOrder.value = newSortOrder;
      // Reset to first page when sorting changes
      page.value = 1;
    }
  }

  function reset() {
    page.value = defaultPage;
    size.value = defaultSize;
    search.value = defaultSearch;
    active.value = defaultActive;
    sortBy.value = defaultSortBy;
    sortOrder.value = defaultSortOrder;
  }

  // Get current state as object
  function getState(): PaginationState {
    return {
      page: page.value,
      size: size.value,
      search: search.value,
      active: active.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    };
  }

  // Get URL params for API calls
  function getApiParams() {
    const params: Record<string, any> = {
      page: page.value,
      size: size.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    };

    if (search.value.trim()) {
      params.search = search.value.trim();
    }

    if (active.value !== undefined) {
      params.active = active.value;
    }

    return params;
  }

  // Initialize on mount
  onMounted(() => {
    initializeFromUrl();
  });

  return {
    // State
    page,
    size,
    search,
    active,
    sortBy,
    sortOrder,
    
    // Actions
    setPage,
    setSize,
    setSearch,
    setActive,
    setSorting,
    reset,
    
    // Getters
    getState,
    getApiParams,
    initializeFromUrl,
  };
}