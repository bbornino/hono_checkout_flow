import { test, expect } from '@playwright/test'

test('signup validates required fields', async ({ page }) => {
  await page.goto('/signup')
  await page.getByRole('textbox', { name: 'Email' }).fill(`test-${Date.now()}@example.com`)
  await page.getByLabel('Password').fill('test123')
  await page.getByRole('button', { name: 'Sign Up' }).click()

  await expect(page.getByText('First name is required')).toBeVisible()
})

test('customer can sign up and lands logged in', async ({ page }) => {
  const email = `e2e-signup-${Date.now()}@example.com`

  await page.goto('/signup')
  await page.getByLabel('First Name').fill('E2E')
  await page.getByLabel('Last Name').fill('Signup')
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByLabel('Password').fill('test123')
  await page.getByRole('button', { name: 'Sign Up' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByText(email)).toBeVisible()
})