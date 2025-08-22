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
</style>