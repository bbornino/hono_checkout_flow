import { test, expect } from '@playwright/test'

test('customer can add, edit, and delete an address', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill('customer@hono.test')
  await page.getByLabel('Password').fill('customer')
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page).toHaveURL('/')
  await page.goto('/addresses')

  const originalLine = `E2E Test St ${Date.now()}`
  const updatedLine = `${originalLine} Updated`

  await test.step('add an address', async () => {
    await page.getByRole('button', { name: 'Add Address' }).click()
    await page.getByLabel('Address', { exact: true }).fill(originalLine)
    await page.getByLabel('City').fill('Testville')
    await page.getByLabel('State').fill('CA')
    await page.getByLabel('Postal Code').fill('90210')
    await page.getByLabel('Country (2-letter code)').fill('US')
    await page.getByRole('button', { name: 'Save Address' }).click()

    await expect(page.getByText(originalLine)).toBeVisible()
  })

  const card = page.getByTestId(/^address-card-/).filter({ hasText: originalLine })

  await test.step('edit the address', async () => {
    await card.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Address', { exact: true }).fill(updatedLine)
    await page.getByRole('button', { name: 'Update Address' }).click()

    await expect(page.getByText(updatedLine)).toBeVisible()
  })

  await test.step('delete the address', async () => {
    const updatedCard = page.getByTestId(/^address-card-/).filter({ hasText: updatedLine })
    await updatedCard.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText(updatedLine)).not.toBeVisible()
  })
})