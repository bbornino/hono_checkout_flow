import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import {customersRouter} from './features/customers.js'
import {addressRouter} from './features/addresses.js'
import {productsRouter} from './features/products.js'
import {discountsRouter} from './features/discounts.js'
import {ordersRouter} from './features/orders.js'
import {paymentsRouter} from './features/payments.js'
import {shipmentsRouter} from './features/shipments.js'
import {authRouter} from './features/auth.js'

const app = new Hono()

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

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
