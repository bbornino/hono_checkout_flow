import {test, expect} from '@playwright/test'

test('Products page loads and shows real products', async ({ page}) => {
    await page.goto('/')
    await expect(page.getByRole('heading', {name: 'Products'})).toBeVisible()
    await expect(page.getByText('Ceramic Coffee Mug')).toBeVisible()
})