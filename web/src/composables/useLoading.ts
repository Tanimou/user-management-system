import { ref, readonly } from 'vue';

export function useLoading() {
  const loading = ref(false);

  const withLoading = async <T>(promise: Promise<T>): Promise<T> => {
    try {
      loading.value = true;
      return await promise;
    } finally {
      loading.value = false;
    }
  };

  const setLoading = (value: boolean) => {
    loading.value = value;
  };

  return {
    loading: readonly(loading),
    withLoading,
    setLoading,
  };
}