import { test, expect } from '@playwright/test'

test('shows empty cart message at checkout', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill('customer@hono.test')
  await page.getByLabel('Password').fill('customer')
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/cart')
  const clearButton = page.getByRole('button', { name: 'Clear Cart' })
  if (await clearButton.isVisible()) {
    await clearButton.click()
  }

  await page.goto('/checkout')
  await expect(page.getByText('Your cart is empty.')).toBeVisible()
})

test('rejects an expired discount code', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill('customer@hono.test')
  await page.getByLabel('Password').fill('customer')
  await page.getByRole('button', { name: 'Log In' }).click()

  await page.getByTestId('product-card-MUG-001').getByRole('button', { name: 'Add to Cart' }).click()
  await page.goto('/checkout')

  await page.getByPlaceholder('Enter a code').fill('EXPIRED')
  await page.getByRole('button', { name: 'Apply' }).click()

  await expect(page.getByText('This discount is not currently valid')).toBeVisible()
})

test('shows add-address prompt for a customer with no saved addresses', async ({ page }) => {
  const email = `e2e-noaddr-${Date.now()}@example.com`

  await page.goto('/signup')
  await page.getByLabel('First Name').fill('No')
  await page.getByLabel('Last Name').fill('Address')
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByLabel('Password').fill('test123')
  await page.getByRole('button', { name: 'Sign Up' }).click()

  await page.getByTestId('product-card-MUG-001').getByRole('button', { name: 'Add to Cart' }).click()
  await page.goto('/checkout')

  await expect(page.getByText('You have no saved addresses.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add an address' })).toBeVisible()
})