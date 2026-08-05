import { test, expect } from '@playwright/test'

test('customer can log in, add a product to cart, and complete checkout', async ({ page }) => {
  await test.step('log in', async () => {
    await page.goto('/login')

    await page.getByLabel('Email').fill('customer@hono.test')
    await page.getByLabel('Password').fill('customer')
    await page.getByRole('button', { name: 'Log In' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByText('customer@hono.test')).toBeVisible()
  })

  await test.step('add a product to cart', async () => {
    const mugCard = page.getByTestId('product-card-MUG-001')
    await mugCard.getByRole('button', { name: 'Add to Cart' }).click()

    await expect(page.getByText('Cart (1)')).toBeVisible()
  })

  await test.step('complete checkout', async () => {
    await page.goto('/checkout')

    await page.getByTestId(/shipping-address-/).first().check()
    await page.getByTestId('place-order-button').click()

    await expect(page).toHaveURL('/orders')
    await expect(page.getByText(/Order #\d+/).first()).toBeVisible()
  })
})