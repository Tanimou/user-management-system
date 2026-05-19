import { test, expect } from '@playwright/test';

test.describe('Authentication Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session data
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should display login form correctly', async ({ page }) => {
    await page.goto('/login');

    // Check page title
    await expect(page).toHaveTitle(/User Management/);

    // Check login form elements
    await expect(page.locator('h1, h2, h3').filter({ hasText: /login/i }).first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"], button').filter({ hasText: /sign in|login/i })).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/login');

    // Try to submit empty form
    await page.locator('button[type="submit"], button').filter({ hasText: /sign in|login/i }).click();

    // Check for validation messages
    await expect(page.locator('.n-form-item-feedback-wrapper, .error, .invalid-feedback')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Submit form
    await page.locator('button[type="submit"], button').filter({ hasText: /sign in|login/i }).click();

    // Should show error message
    await expect(page.locator('.n-alert, .error-message, .alert')).toBeVisible();
    await expect(page.locator('text=/invalid|incorrect|failed/i')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Mock the API response for successful login
    await page.route('**/api/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'mock-jwt-token',
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            roles: ['user'],
            isActive: true,
          },
        }),
      });
    });

    // Fill in valid credentials
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'ValidPassword123!');

    // Submit form
    await page.locator('button[type="submit"], button').filter({ hasText: /sign in|login/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show loading state during login', async ({ page }) => {
    await page.goto('/login');

    // Mock slow API response
    await page.route('**/api/login', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'mock-jwt-token',
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            roles: ['user'],
            isActive: true,
          },
        }),
      });
    });

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'ValidPassword123!');

    // Submit form
    await page.locator('button[type="submit"], button').filter({ hasText: /sign in|login/i }).click();

    // Should show loading state
    await expect(page.locator('button[disabled], .loading, [data-loading="true"]')).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/login');

    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="email"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="password"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('button[type="submit"], button').filter({ hasText: /sign in|login/i })).toBeFocused();
  });

  test('should submit form with Enter key', async ({ page }) => {
    await page.goto('/login');

    // Mock API response
    await page.route('**/api/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'mock-jwt-token',
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            roles: ['user'],
            isActive: true,
          },
        }),
      });
    });

    // Fill form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'ValidPassword123!');

    // Submit with Enter key
    await page.keyboard.press('Enter');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Dashboard Access Control', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should access dashboard when authenticated', async ({ page }) => {
    // Mock authentication state
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-jwt-token');
    });

    // Mock API responses
    await page.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            roles: ['user'],
            isActive: true,
          },
        }),
      });
    });

    await page.route('**/api/users*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          pagination: {
            page: 1,
            size: 10,
            total: 0,
            totalPages: 0,
          },
        }),
      });
    });

    await page.goto('/dashboard');

    // Should stay on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1, h2').filter({ hasText: /dashboard/i })).toBeVisible();
  });
});

test.describe('User Management Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-jwt-token');
    });

    // Mock auth API
    await page.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: 1,
            name: 'Admin User',
            email: 'admin@example.com',
            roles: ['user', 'admin'],
            isActive: true,
          },
        }),
      });
    });
  });

  test('should display user list', async ({ page }) => {
    await page.route('**/api/users*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 1,
              name: 'John Doe',
              email: 'john@example.com',
              roles: ['user'],
              isActive: true,
              createdAt: '2024-01-15T10:00:00Z',
            },
            {
              id: 2,
              name: 'Jane Smith',
              email: 'jane@example.com',
              roles: ['user', 'admin'],
              isActive: true,
              createdAt: '2024-01-15T11:00:00Z',
            },
          ],
          pagination: {
            page: 1,
            size: 10,
            total: 2,
            totalPages: 1,
          },
        }),
      });
    });

    await page.goto('/users');

    // Check user list
    await expect(page.locator('table, .user-list, .data-table')).toBeVisible();
    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(page.locator('text=Jane Smith')).toBeVisible();
  });

  test('should open create user modal', async ({ page }) => {
    await page.route('**/api/users*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          pagination: { page: 1, size: 10, total: 0, totalPages: 0 },
        }),
      });
    });

    await page.goto('/users');

    // Click create user button
    await page.locator('button').filter({ hasText: /create|add|new/i }).first().click();

    // Should open create user modal
    await expect(page.locator('.n-modal, .modal, .dialog')).toBeVisible();
    await expect(page.locator('input[placeholder*="name"], input[aria-label*="name"]')).toBeVisible();
    await expect(page.locator('input[type="email"], input[placeholder*="email"]')).toBeVisible();
  });

  test('should create a new user', async ({ page }) => {
    await page.route('**/api/users*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [],
            pagination: { page: 1, size: 10, total: 0, totalPages: 0 },
          }),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 3,
              name: 'New User',
              email: 'newuser@example.com',
              roles: ['user'],
              isActive: true,
              createdAt: '2024-01-15T12:00:00Z',
            },
          }),
        });
      }
    });

    await page.goto('/users');

    // Open create user modal
    await page.locator('button').filter({ hasText: /create|add|new/i }).first().click();

    // Fill form
    await page.fill('input[placeholder*="name"], input[aria-label*="name"]', 'New User');
    await page.fill('input[type="email"], input[placeholder*="email"]', 'newuser@example.com');

    // Submit form
    await page.locator('button').filter({ hasText: /save|create|submit/i }).click();

    // Should show success message
    await expect(page.locator('.n-message, .success, .alert-success')).toBeVisible();

    // Modal should close
    await expect(page.locator('.n-modal, .modal, .dialog')).not.toBeVisible();
  });

  test('should handle search functionality', async ({ page }) => {
    await page.route('**/api/users*', async route => {
      const url = route.request().url();
      const searchParam = new URL(url).searchParams.get('search');
      
      if (searchParam === 'john') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 1,
                name: 'John Doe',
                email: 'john@example.com',
                roles: ['user'],
                isActive: true,
              },
            ],
            pagination: { page: 1, size: 10, total: 1, totalPages: 1 },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [],
            pagination: { page: 1, size: 10, total: 0, totalPages: 0 },
          }),
        });
      }
    });

    await page.goto('/users');

    // Search for user
    await page.fill('input[placeholder*="search"], input[type="search"]', 'john');
    await page.keyboard.press('Enter');

    // Should show filtered results
    await expect(page.locator('text=John Doe')).toBeVisible();
  });
});

test.describe('Role-Based Access Control', () => {
  test('should show admin features for admin users', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-jwt-token');
    });

    await page.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: 1,
            name: 'Admin User',
            email: 'admin@example.com',
            roles: ['user', 'admin'],
            isActive: true,
          },
        }),
      });
    });

    await page.route('**/api/users*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          pagination: { page: 1, size: 10, total: 0, totalPages: 0 },
        }),
      });
    });

    await page.goto('/users');

    // Should show admin features
    await expect(page.locator('button').filter({ hasText: /create|add/i })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /edit|update/i }).first()).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /delete|remove/i }).first()).toBeVisible();
  });

  test('should hide admin features for regular users', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-jwt-token');
    });

    await page.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: 1,
            name: 'Regular User',
            email: 'user@example.com',
            roles: ['user'],
            isActive: true,
          },
        }),
      });
    });

    await page.route('**/api/users*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          pagination: { page: 1, size: 10, total: 0, totalPages: 0 },
        }),
      });
    });

    await page.goto('/users');

    // Should not show admin features
    await expect(page.locator('button').filter({ hasText: /create|add/i })).not.toBeVisible();
  });
});

test.describe('Logout Flow', () => {
  test('should logout successfully', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-jwt-token');
    });

    await page.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            roles: ['user'],
            isActive: true,
          },
        }),
      });
    });

    await page.route('**/api/logout', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/dashboard');

    // Click logout button
    await page.locator('button').filter({ hasText: /logout|sign out/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Should clear authentication
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBeNull();
  });
});