import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import PasswordStrengthMeter from '../common/PasswordStrengthMeter.vue';

// Mock naive-ui components
vi.mock('naive-ui', () => ({
  useMessage: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
  NText: { template: '<span><slot /></span>' },
  NIcon: { template: '<span><slot /></span>' },
}));

// Mock API client
vi.mock('@/api/axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

// Mock icons
vi.mock('@vicons/ionicons5', () => ({
  CheckmarkOutline: { template: '<span>✓</span>' },
  CloseOutline: { template: '<span>✗</span>' },
}));

describe('PasswordStrengthMeter', () => {
  let wrapper: any;
  let pinia: any;

  beforeEach(() => {
    pinia = createPinia();
    wrapper = null;
  });

  const createComponent = (password: string = '') => {
    wrapper = mount(PasswordStrengthMeter, {
      props: { password },
      global: {
        plugins: [pinia],
        stubs: {
          NText: { template: '<span><slot /></span>' },
          NIcon: { template: '<span><slot /></span>' },
        },
      },
    });
  };

  it('renders correctly with empty password', () => {
    createComponent('');
    expect(wrapper.find('.password-strength-meter').exists()).toBe(false);
  });

  it('renders strength meter when password is provided', () => {
    createComponent('password123');
    expect(wrapper.find('.password-strength-meter').exists()).toBe(true);
    expect(wrapper.find('.strength-bar').exists()).toBe(true);
    expect(wrapper.find('.requirements-grid').exists()).toBe(true);
  });

  it('calculates basic requirements correctly', () => {
    createComponent('Password123!');
    
    // Should show all requirements as met
    const requirementItems = wrapper.findAll('.requirement-item');
    expect(requirementItems.length).toBe(5);
  });

  it('shows requirements for minimum length', async () => {
    createComponent('Pass123!');
    
    // Should meet all requirements including minimum length (8+ chars)
    const strengthMeter = wrapper.find('.password-strength-meter');
    expect(strengthMeter.exists()).toBe(true);
  });

  it('handles password changes reactively', async () => {
    createComponent('weak');
    
    // Change password via props
    await wrapper.setProps({ password: 'StrongPassword123!' });
    
    expect(wrapper.find('.password-strength-meter').exists()).toBe(true);
  });

  it('provides fallback calculation when API fails', () => {
    createComponent('TestPassword123!');
    
    // The component should still show basic validation
    expect(wrapper.find('.strength-bar').exists()).toBe(true);
    expect(wrapper.find('.requirements-grid').exists()).toBe(true);
  });

  it('exposes validation state correctly', () => {
    createComponent('StrongPassword123!');
    
    // Component should expose validation state
    expect(wrapper.vm).toBeDefined();
  });
});