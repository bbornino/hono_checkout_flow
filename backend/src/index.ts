import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { corsMiddleware } from './middleware/cors.js'

import {customersRouter} from './features/customers.js'
import {addressRouter} from './features/addresses.js'
import {productsRouter} from './features/products.js'
import {discountsRouter} from './features/discounts.js'
import {ordersRouter} from './features/orders.js'
import {paymentsRouter} from './features/payments.js'
import {shipmentsRouter} from './features/shipments.js'
import {authRouter} from './features/auth.js'
import {checkoutRouter} from './features/checkout.js'

const app = new Hono()

app.use('*', logger((message, ...rest) => {
  const datestamp = new Date().toLocaleDateString()
  const timestamp = new Date().toLocaleTimeString()

  console.log(`[${datestamp} ${timestamp}] ${message}`, ...rest)
}))
app.use('*', corsMiddleware)

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/health', (c) => {
  return c.text('ok')
})

app.route('/customers', customersRouter)
app.route('/addresses', addressRouter)
app.route('/products', productsRouter)
app.route('/discounts', discountsRouter)
app.route('/orders', ordersRouter)
app.route('/payments', paymentsRouter)
app.route('/shipments', shipmentsRouter)
app.route('/auth', authRouter)
app.route('/checkout', checkoutRouter)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
