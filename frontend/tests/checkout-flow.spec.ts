import { test, expect } from '@playwright/test'

test('customer can log in and add a product to cart', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill('customer@hono.test')
    await page.getByLabel('Password').fill('customer')
    await page.getByRole('button', { name: 'Log In' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByText('customer@hono.test')).toBeVisible()

    const mugCard = page.getByTestId('product-card-MUG-001')
    await mugCard.getByRole('button', { name: 'Add to Cart' }).click()

    await expect(page.getByText('Cart (1)')).toBeVisible()
})