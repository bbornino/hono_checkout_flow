import { Hono } from 'hono'
import { TAX_RATE, SHIPPING_CENTS } from '../constants.js'

const checkoutRouter = new Hono()

checkoutRouter.get('/config', async (context) => {
    return context.json({ taxRate: TAX_RATE, shippingCents: SHIPPING_CENTS})
})

export { checkoutRouter }