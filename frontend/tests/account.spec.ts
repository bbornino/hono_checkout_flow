import { test, expect } from '@playwright/test'

test('customer can update profile and change password', async ({ page }) => {
  const email = `e2e-account-${Date.now()}@example.com`
  const password = 'original123'

  await test.step('sign up a fresh account', async () => {
    await page.goto('/signup')
    await page.getByLabel('First Name').fill('Account')
    await page.getByLabel('Last Name').fill('Tester')
    await page.getByRole('textbox', { name: 'Email' }).fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign Up' }).click()
    await expect(page).toHaveURL('/')
  })

  await page.goto('/account')

  await test.step('update profile info', async () => {
    await page.getByLabel('Phone (optional)').fill('+15559998888')
    await page.getByRole('button', { name: 'Save Profile' }).click()
    await expect(page.getByText('Profile updated.')).toBeVisible()
  })

  await test.step('rejects wrong current password', async () => {
    await page.getByLabel('Current Password').fill('wrong-password')
    await page.getByLabel('New Password').fill('temp123')
    await page.getByRole('button', { name: 'Update Password' }).click()
    await expect(page.getByText('Current password is incorrect')).toBeVisible()
  })

  await test.step('changes password successfully', async () => {
    await page.getByLabel('Current Password').fill(password)
    await page.getByLabel('New Password').fill('temp123')
    await page.getByRole('button', { name: 'Update Password' }).click()
    await expect(page.getByText('Password changed.')).toBeVisible()
  })
})