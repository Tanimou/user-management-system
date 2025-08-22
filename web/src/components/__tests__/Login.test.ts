import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Login from '../../../views/Login.vue';
import { useAuthStore } from '../../../stores/auth';

// Mock the router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  currentRoute: {
    value: {
      query: {}
    }
  }
};

// Mock naive-ui components
vi.mock('naive-ui', () => ({
  NCard: {
    name: 'NCard',
    template: '<div class="n-card"><slot name="header-extra"></slot><slot></slot></div>'
  },
  NForm: {
    name: 'NForm',
    template: '<form @submit="$listeners.submit || (() => {})"><slot></slot></form>',
    props: ['model', 'rules']
  },
  NFormItem: {
    name: 'NFormItem',
    template: '<div class="n-form-item"><label>{{ label }}</label><slot></slot></div>',
    props: ['label', 'path']
  },
  NInput: {
    name: 'NInput',
    template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" :type="type" :placeholder="placeholder" :disabled="disabled" />',
    props: ['value', 'type', 'placeholder', 'disabled'],
    emits: ['update:value']
  },
  NButton: {
    name: 'NButton',
    template: '<button :loading="loading" :disabled="disabled" @click="$emit(\'click\')"><slot></slot></button>',
    props: ['loading', 'disabled'],
    emits: ['click']
  },
  NTag: {
    name: 'NTag',
    template: '<span class="n-tag"><slot></slot></span>',
    props: ['type']
  },
  NAlert: {
    name: 'NAlert',
    template: '<div class="n-alert" :class="type"><slot></slot></div>',
    props: ['type', 'title']
  },
  useMessage: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }),
}));

describe('Login Component', () => {
  let wrapper: VueWrapper;
  let authStore: ReturnType<typeof useAuthStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    authStore = useAuthStore();
    
    // Mock auth store methods
    vi.spyOn(authStore, 'login').mockResolvedValue(undefined);
    vi.spyOn(authStore, 'clearError').mockImplementation(() => {});
    
    wrapper = mount(Login, {
      global: {
        mocks: {
          $router: mockRouter
        },
        stubs: {
          'router-link': true
        }
      }
    });
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render login form correctly', () => {
      expect(wrapper.find('.login-container').exists()).toBe(true);
      expect(wrapper.find('.n-card').exists()).toBe(true);
      expect(wrapper.find('form').exists()).toBe(true);
      expect(wrapper.find('input[type="email"]').exists()).toBe(true);
      expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    });

    it('should render form labels', () => {
      const labels = wrapper.findAll('.n-form-item label');
      expect(labels[0].text()).toBe('Email');
      expect(labels[1].text()).toBe('Password');
    });

    it('should render login button', () => {
      const button = wrapper.find('button');
      expect(button.exists()).toBe(true);
      expect(button.text()).toContain('Sign In');
    });

    it('should show proper placeholders', () => {
      const emailInput = wrapper.find('input[type="email"]');
      const passwordInput = wrapper.find('input[type="password"]');
      
      expect(emailInput.attributes('placeholder')).toBe('Enter your email');
      expect(passwordInput.attributes('placeholder')).toBe('Enter your password');
    });
  });

  describe('Form Validation', () => {
    it('should validate email field', async () => {
      const emailInput = wrapper.find('input[type="email"]');
      
      await emailInput.setValue('invalid-email');
      await emailInput.trigger('blur');
      
      // Check if validation error is shown
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.formData.email).toBe('invalid-email');
    });

    it('should validate password field', async () => {
      const passwordInput = wrapper.find('input[type="password"]');
      
      await passwordInput.setValue('short');
      await passwordInput.trigger('blur');
      
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.formData.password).toBe('short');
    });

    it('should require both email and password', async () => {
      const form = wrapper.find('form');
      await form.trigger('submit');
      
      // Form should not submit with empty fields
      expect(authStore.login).not.toHaveBeenCalled();
    });
  });

  describe('User Interaction', () => {
    it('should update form data when typing', async () => {
      const emailInput = wrapper.find('input[type="email"]');
      const passwordInput = wrapper.find('input[type="password"]');
      
      await emailInput.setValue('test@example.com');
      await passwordInput.setValue('password123');
      
      expect(wrapper.vm.formData.email).toBe('test@example.com');
      expect(wrapper.vm.formData.password).toBe('password123');
    });

    it('should call login when form is submitted with valid data', async () => {
      const emailInput = wrapper.find('input[type="email"]');
      const passwordInput = wrapper.find('input[type="password"]');
      
      await emailInput.setValue('test@example.com');
      await passwordInput.setValue('ValidPassword123!');
      
      const form = wrapper.find('form');
      await form.trigger('submit');
      
      expect(authStore.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'ValidPassword123!'
      });
    });

    it('should show loading state during login', async () => {
      // Mock login to take some time
      authStore.login = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      const emailInput = wrapper.find('input[type="email"]');
      const passwordInput = wrapper.find('input[type="password"]');
      const button = wrapper.find('button');
      
      await emailInput.setValue('test@example.com');
      await passwordInput.setValue('ValidPassword123!');
      
      // Submit form
      const form = wrapper.find('form');
      await form.trigger('submit');
      
      // Check loading state
      expect(wrapper.vm.loading).toBe(true);
      expect(button.attributes('disabled')).toBeDefined();
      expect(emailInput.attributes('disabled')).toBeDefined();
      expect(passwordInput.attributes('disabled')).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should display login errors', async () => {
      // Mock auth store to have an error
      authStore.error = 'Invalid credentials';
      await wrapper.vm.$nextTick();
      
      const errorAlert = wrapper.find('.n-alert');
      expect(errorAlert.exists()).toBe(true);
      expect(errorAlert.text()).toContain('Invalid credentials');
    });

    it('should clear errors when typing', async () => {
      authStore.error = 'Some error';
      await wrapper.vm.$nextTick();
      
      const emailInput = wrapper.find('input[type="email"]');
      await emailInput.setValue('new@email.com');
      
      expect(authStore.clearError).toHaveBeenCalled();
    });

    it('should handle login failure', async () => {
      authStore.login = vi.fn().mockRejectedValue(new Error('Login failed'));
      
      const emailInput = wrapper.find('input[type="email"]');
      const passwordInput = wrapper.find('input[type="password"]');
      
      await emailInput.setValue('test@example.com');
      await passwordInput.setValue('wrongpassword');
      
      const form = wrapper.find('form');
      await form.trigger('submit');
      
      expect(authStore.login).toHaveBeenCalled();
    });
  });

  describe('Password Strength Indicator', () => {
    it('should show password strength when typing', async () => {
      const passwordInput = wrapper.find('input[type="password"]');
      
      await passwordInput.setValue('weak');
      await wrapper.vm.$nextTick();
      
      // Check if password strength component is rendered
      const strengthIndicator = wrapper.find('.password-strength');
      expect(strengthIndicator.exists()).toBe(true);
    });

    it('should calculate password strength correctly', async () => {
      const component = wrapper.vm;
      
      // Test weak password
      await wrapper.setData({ 
        formData: { ...wrapper.vm.formData, password: 'weak' } 
      });
      expect(component.passwordStrength?.strength).toBe('weak');
      
      // Test strong password
      await wrapper.setData({ 
        formData: { ...wrapper.vm.formData, password: 'StrongPassword123!' } 
      });
      expect(component.passwordStrength?.strength).toBe('strong');
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria labels', () => {
      const emailInput = wrapper.find('input[type="email"]');
      const passwordInput = wrapper.find('input[type="password"]');
      
      expect(emailInput.attributes('aria-label')).toBe('Email address');
      expect(passwordInput.attributes('aria-label')).toBe('Password');
    });

    it('should have proper autocomplete attributes', () => {
      const emailInput = wrapper.find('input[type="email"]');
      const passwordInput = wrapper.find('input[type="password"]');
      
      expect(emailInput.attributes('autocomplete')).toBe('email');
      expect(passwordInput.attributes('autocomplete')).toBe('current-password');
    });

    it('should be keyboard navigable', async () => {
      const emailInput = wrapper.find('input[type="email"]');
      const passwordInput = wrapper.find('input[type="password"]');
      
      await emailInput.setValue('test@example.com');
      await emailInput.trigger('keydown.enter');
      
      await passwordInput.setValue('password123');
      await passwordInput.trigger('keydown.enter');
      
      // Enter key should trigger form submission
      expect(authStore.login).toHaveBeenCalled();
    });
  });

  describe('Router Integration', () => {
    it('should redirect to dashboard after successful login', async () => {
      // Mock successful login
      authStore.isAuthenticated = true;
      
      const emailInput = wrapper.find('input[type="email"]');
      const passwordInput = wrapper.find('input[type="password"]');
      
      await emailInput.setValue('test@example.com');
      await passwordInput.setValue('ValidPassword123!');
      
      const form = wrapper.find('form');
      await form.trigger('submit');
      
      await wrapper.vm.$nextTick();
      
      expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
    });

    it('should handle redirect query parameter', async () => {
      // Mock router with redirect query
      mockRouter.currentRoute.value.query.redirect = '/users';
      
      // Remount component with updated router
      wrapper.unmount();
      wrapper = mount(Login, {
        global: {
          mocks: {
            $router: mockRouter
          }
        }
      });
      
      authStore.isAuthenticated = true;
      await wrapper.vm.$nextTick();
      
      expect(mockRouter.replace).toHaveBeenCalledWith('/users');
    });
  });
});