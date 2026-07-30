import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { BASE_URL } from '../constants.js'

describe('Orders API', () => {
  let testCustomerId: number
  let testAddressId: number
  let testProductId: number
  let testOrderId: number

  beforeAll(async () => {
    const customerRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Order',
        lastName: 'Tester',
        email: `order-test-${Date.now()}@example.com`,
      }),
    })
    const customer = await customerRes.json()
    testCustomerId = customer.id

    const addressRes = await fetch(`${BASE_URL}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        addressLine1: '123 Test St',
        city: 'Testville',
        state: 'CA',
        postalCode: '90210',
        country: 'US',
      }),
    })
    const address = await addressRes.json()
    testAddressId = address.id

    const productRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: `ORDER-TEST-${Date.now()}`,
        name: 'Order Test Product',
        priceCents: 1000,
        weightOz: 5,
      }),
    })
    const product = await productRes.json()
    testProductId = product.id
  })

  afterAll(async () => {
    await fetch(`${BASE_URL}/products/${testProductId}`, { method: 'DELETE' })
    await fetch(`${BASE_URL}/addresses/${testAddressId}`, { method: 'DELETE' })
    await fetch(`${BASE_URL}/customers/${testCustomerId}`, { method: 'DELETE' })
  })

  describe('POST /orders', () => {
    it('creates an order with valid data', async () => {
      const response = await fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomerId,
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [{ productId: testProductId, quantity: 3 }],
        }),
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.status).toBe('pending')
      expect(body.subtotalCents).toBe(3000)
      testOrderId = body.id
    })

    it('rejects an order with a nonexistent productId', async () => {
      const response = await fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomerId,
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [{ productId: 9999999, quantity: 1 }],
        }),
      })

      expect(response.status).toBe(400)
    })

    it('rejects an order with an empty items array', async () => {
      const response = await fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomerId,
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [],
        }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe('GET /orders/:orderId', () => {
    it('returns the order with joined items', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.items.length).toBe(1)
      expect(body.items[0].productName).toBe('Order Test Product')
    })

    it('returns 404 for a nonexistent order', async () => {
      const response = await fetch(`${BASE_URL}/orders/9999999`)
      expect(response.status).toBe(404)
    })

    it('returns the order with its status event history', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`)
      const body = await response.json()

      expect(body.events.length).toBeGreaterThanOrEqual(1)
      expect(body.events[0].status).toBe('pending')
    })

    it('adds a new event when status changes', async () => {
      const orderRes = await fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomerId,
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [{ productId: testProductId, quantity: 1 }],
        }),
      })
      const order = await orderRes.json()

      await fetch(`${BASE_URL}/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      })

      const response = await fetch(`${BASE_URL}/orders/${order.id}`)
      const body = await response.json()

      expect(body.events.length).toBe(2)
      expect(body.events[1].status).toBe('paid')
    })
  })

  describe('GET /orders', () => {
    it('filters by customerId', async () => {
      const response = await fetch(`${BASE_URL}/orders?customerId=${testCustomerId}`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.some((o: any) => o.id === testOrderId)).toBe(true)
    })

    it('filters by status', async () => {
      const response = await fetch(`${BASE_URL}/orders?status=pending`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.some((o: any) => o.id === testOrderId)).toBe(true)
    })
  })

  describe('PATCH /orders/:orderId', () => {
    it('allows pending -> paid', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('paid')
    })

    it('rejects paid -> delivered (illegal jump)', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' }),
      })

      expect(response.status).toBe(409)
    })

    it('allows paid -> refunded', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'refunded' }),
      })

      expect(response.status).toBe(200)
    })

    it('rejects any transition out of a terminal status', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      })

      expect(response.status).toBe(409)
    })

    it('returns 404 for a nonexistent order', async () => {
      const response = await fetch(`${BASE_URL}/orders/9999999`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      })

      expect(response.status).toBe(404)
    })
  })
})