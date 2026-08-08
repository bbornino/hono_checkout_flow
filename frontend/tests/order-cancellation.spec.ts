import { test, expect } from '@playwright/test'

test('customer can cancel their own order via the UI', async ({ page }) => {
  const email = `e2e-cancel-${Date.now()}@example.com`

  await test.step('sign up and add an address', async () => {
    await page.goto('/signup')
    await page.getByLabel('First Name').fill('Cancel')
    await page.getByLabel('Last Name').fill('Tester')
    await page.getByRole('textbox', { name: 'Email' }).fill(email)
    await page.getByLabel('Password').fill('test123')
    await page.getByRole('button', { name: 'Sign Up' }).click()
    await expect(page).toHaveURL('/')

    await page.goto('/addresses')
    await page.getByRole('button', { name: 'Add Address' }).click()
    await page.getByLabel('Address', { exact: true }).fill('1 Test Way')
    await page.getByLabel('City').fill('Testville')
    await page.getByLabel('State').fill('CA')
    await page.getByLabel('Postal Code').fill('90210')
    await page.getByLabel('Country (2-letter code)').fill('US')
    await page.getByRole('button', { name: 'Save Address' }).click()
  })

  await page.goto('/')

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