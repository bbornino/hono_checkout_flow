import { test, expect } from '@playwright/test'

test('customer can log in, add a product to cart, and complete checkout', async ({ page }) => {
  const email = `e2e-checkout-${Date.now()}@example.com`

  await test.step('sign up and add an address', async () => {
    await page.goto('/signup')
    await page.getByLabel('First Name').fill('Checkout')
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