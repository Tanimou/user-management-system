import { expect, Page, test } from '@playwright/test';
import path from 'path';

// Helper to login programmatically via UI (simpler than injecting token because app handles storage/cookies)
async function login(page: Page) {
  await page.goto('http://localhost:5173/login');
  await page.getByRole('textbox', { name: /email/i }).fill('admin@example.com');
  await page.getByPlaceholder('Password').fill('AdminSecure2024!@#');
  await page.getByRole('button', { name: /login/i }).click();
  await page.waitForURL('**/dashboard').catch(() => {}); // some flows may redirect elsewhere first
  // Navigate to profile explicitly
  await page.goto('http://localhost:5173/profile');
  await expect(page.getByText('Change Photo')).toBeVisible();
}

test.describe('Avatar Upload', () => {
  test('successful avatar upload', async ({ page }) => {
    await login(page);
    await page.getByText('Change Photo').click();
    await expect(page.getByText('Change Profile Photo')).toBeVisible();
    const filePath = path.join(
      process.cwd(),
      'gestion_user_create_user_form.png'
    );
    const fileInput = page.locator('input[type=file]').first();
    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(500); // wait for preview generation
    await page.getByRole('button', { name: /save photo/i }).click();
    // Expect success message toast (naive-ui uses role alert?) fallback to text search
    await expect(
      page.locator('text=Profile photo updated').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('reject invalid file type', async ({ page }) => {
    await login(page);
    await page.getByText('Change Photo').click();
    await expect(page.getByText('Change Profile Photo')).toBeVisible();
    const fileInput = page.locator('input[type=file]').first();
    await fileInput.setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });
    await expect(
      page.locator('text=Please upload an image file')
    ).toBeVisible();
  });

  test('reject oversize file', async ({ page }) => {
    await login(page);
    await page.getByText('Change Photo').click();
    await expect(page.getByText('Change Profile Photo')).toBeVisible();
    const fileInput = page.locator('input[type=file]').first();
    const bigBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024, 0xff); // >5MB
    await fileInput.setInputFiles({
      name: 'big.png',
      mimeType: 'image/png',
      buffer: bigBuffer,
    });
    await expect(
      page.locator('text=File size must be less than 5MB')
    ).toBeVisible();
  });
});
