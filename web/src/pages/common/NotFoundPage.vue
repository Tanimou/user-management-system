<template>
  <div class="not-found-container">
    <n-result
      status="404"
      title="404 Not Found"
      description="The page you're looking for doesn't exist."
    >
      <template #footer>
        <n-button type="primary" @click="$router.push('/')">
          Back to Dashboard
        </n-button>
      </template>
    </n-result>
  </div>
</template>

<script setup lang="ts">
// Empty - all functionality is in template
</script>

<style scoped>
.not-found-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .not-found-container {
    padding: 1rem;
  }
  
  .not-found-container :deep(.n-result .n-result-header) {
    font-size: 18px;
  }
  
  .not-found-container :deep(.n-result .n-result-description) {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .not-found-container {
    padding: 0.5rem;
  }
  
  .not-found-container :deep(.n-result .n-result-header) {
    font-size: 16px;
  }
  
  .not-found-container :deep(.n-result .n-result-description) {
    font-size: 13px;
  }
  
  .not-found-container :deep(.n-button) {
    width: 100%;
  }
}
</style>