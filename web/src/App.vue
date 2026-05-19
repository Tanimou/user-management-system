<template>
  <n-config-provider :theme="null">
    <n-loading-bar-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <n-message-provider>
            <router-view />
          </n-message-provider>
        </n-notification-provider>
      </n-dialog-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
// Empty setup - all logic is in main.ts and individual components
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background-color: #f5f5f5;
  overflow-x: hidden; /* Prevent horizontal scrolling */
}

#app {
  height: 100vh;
  width: 100vw;
}

/* Global responsive utilities */
@media (max-width: 768px) {
  body {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  body {
    font-size: 13px;
  }
}

/* Ensure touch targets are at least 44px for accessibility */
@media (hover: none) and (pointer: coarse) {
  button, .n-button, .n-input, .n-select {
    min-height: 44px !important;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  body {
    background-color: #ffffff;
    color: #000000;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>