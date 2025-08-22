// Test setup file for web workspace
import { vi } from 'vitest';
import { config } from '@vue/test-utils';

// Mock environment variables
Object.defineProperty(process, 'env', {
  value: {
    NODE_ENV: 'test',
    VITE_API_BASE_URL: 'http://localhost:3001/api'
  }
});

// Mock icons - Vue component format
vi.mock('@vicons/ionicons5', () => ({
  CheckmarkOutline: {
    name: 'CheckmarkOutline',
    render: () => 'checkmark-outline-icon',
    setup: () => ({})
  },
  CloseOutline: {
    name: 'CloseOutline',
    render: () => 'close-outline-icon', 
    setup: () => ({})
  }
}));

// Global component stubs for Vue Test Utils
config.global.stubs = {
  NCard: {
    name: 'NCard',
    template: '<div class="n-card"><slot /></div>'
  },
  NForm: {
    name: 'NForm', 
    template: '<form class="n-form" @submit.prevent="$emit(\'submit\')"><slot /></form>',
    emits: ['submit']
  },
  NFormItem: {
    name: 'NFormItem',
    template: '<div class="n-form-item"><label v-if="label">{{ label }}</label><slot /></div>',
    props: ['label']
  },
  NInput: {
    name: 'NInput',
    template: `
      <input 
        class="n-input" 
        :type="type || 'text'" 
        :placeholder="placeholder"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        v-bind="$attrs"
      />
    `,
    props: ['type', 'placeholder', 'modelValue'],
    emits: ['update:modelValue'],
    inheritAttrs: false
  },
  NButton: {
    name: 'NButton',
    template: `
      <button 
        class="n-button" 
        :type="htmlType || 'button'" 
        :disabled="loading || disabled"
        @click="$emit('click', $event)"
      >
        <slot />
      </button>
    `,
    props: ['htmlType', 'loading', 'disabled'],
    emits: ['click']
  },
  NCheckbox: {
    name: 'NCheckbox',
    template: `
      <input 
        type="checkbox" 
        class="n-checkbox" 
        :checked="modelValue"
        @change="$emit('update:modelValue', $event.target.checked)"
      />
    `,
    props: ['modelValue'],
    emits: ['update:modelValue']
  },
  NSpin: {
    name: 'NSpin',
    template: '<div class="n-spin" :class="{ spinning: show }"><slot /></div>',
    props: ['show']
  },
  NAlert: {
    name: 'NAlert',
    template: '<div class="n-alert" :class="`n-alert--${type}`"><slot /></div>',
    props: ['type']
  },
  NIcon: {
    name: 'NIcon',
    template: '<span class="n-icon"><slot /></span>'
  },
  NTag: {
    name: 'NTag',
    template: '<span class="n-tag" :class="`n-tag--${type}`"><slot /></span>',
    props: ['type']
  }
};

// Mock naive-ui composables
vi.mock('naive-ui', () => ({
  // Composables
  useMessage: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }),
  useDialog: () => ({
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn()
  })
}));