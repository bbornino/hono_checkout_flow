import { test, expect } from '@playwright/test'

test('customer can cancel their own order via the UI', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill('customer@hono.test')
  await page.getByLabel('Password').fill('customer')
  await page.getByRole('button', { name: 'Log In' }).click()

  await page.getByTestId('product-card-MUG-001').getByRole('button', { name: 'Add to Cart' }).click()
  await page.goto('/checkout')

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/orders') && res.request().method() === 'POST'),
    (async () => {
      await page.getByTestId(/shipping-address-/).first().check()
      await page.getByTestId('place-order-button').click()
    })(),
  ])

  const newOrder = await response.json()
  const orderCard = page.getByTestId(`order-card-${newOrder.id}`)

  await expect(page).toHaveURL('/orders')
  await orderCard.click()
  await orderCard.getByRole('button', { name: 'Cancel Order' }).click()

  await expect(orderCard.getByText('cancelled')).toBeVisible()
  await expect(orderCard.getByRole('button', { name: 'Cancel Order' })).not.toBeVisible()
})