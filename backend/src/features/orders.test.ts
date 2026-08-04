import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { BASE_URL } from '../constants.js'

describe('Orders API', () => {
  let testCustomerId: number
  let testAddressId: number
  let testProductId: number
  let testOrderId: number
  let adminToken: string
  let customerToken: string

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

    const adminEmail = `order-admin-${Date.now()}@example.com`
    await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'admin', role: 'admin' }),
    })
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'admin' }),
    })
    adminToken = (await adminLoginRes.json()).token

    const addressRes = await fetch(`${BASE_URL}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
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
    testProductId = (await productRes.json()).id

    const customerEmail = customer.email
    await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerEmail,
        password: 'customer',
        role: 'customer',
        existingCustomerId: testCustomerId,
      }),
    })
    const customerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerEmail, password: 'customer' }),
    })
    customerToken = (await customerLoginRes.json()).token
  })

  afterAll(async () => {
    await fetch(`${BASE_URL}/products/${testProductId}`, { method: 'DELETE' })
    await fetch(`${BASE_URL}/addresses/${testAddressId}`, { method: 'DELETE' })
    await fetch(`${BASE_URL}/customers/${testCustomerId}`, { method: 'DELETE' })
  })

  describe('Auth protection', () => {
    it('rejects GET /orders with no token', async () => {
      const response = await fetch(`${BASE_URL}/orders`)
      expect(response.status).toBe(401)
    })

    it('rejects POST /orders with no token', async () => {
      const response = await fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomerId,
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [{ productId: testProductId, quantity: 1 }],
        }),
      })
      expect(response.status).toBe(401)
    })
  })

  describe('POST /orders', () => {
    it('creates an order as a customer, ignoring a spoofed customerId', async () => {
      const response = await fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({
          customerId: 999999,
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [{ productId: testProductId, quantity: 3 }],
        }),
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.customerId).toBe(testCustomerId)
      expect(body.subtotalCents).toBe(3000)
      testOrderId = body.id
    })

    it('allows admin to place an order on behalf of a customer', async () => {
      const response = await fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          customerId: testCustomerId,
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [{ productId: testProductId, quantity: 1 }],
        }),
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.customerId).toBe(testCustomerId)
    })

    it('rejects an order with a nonexistent productId', async () => {
      const response = await fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
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
    it('allows a customer to view their own order', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.items.length).toBe(1)
      expect(body.items[0].productName).toBe('Order Test Product')
    })

    it('allows admin to view any order', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(response.status).toBe(200)
    })

    it('rejects a customer viewing an order that is not theirs', async () => {
      const response = await fetch(`${BASE_URL}/orders/1`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      })
      expect(response.status).toBe(404)
    })

    it('returns 404 for a nonexistent order', async () => {
      const response = await fetch(`${BASE_URL}/orders/9999999`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(response.status).toBe(404)
    })

    it('returns the order with its status event history', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      })
      const body = await response.json()
      expect(body.events.length).toBeGreaterThanOrEqual(1)
      expect(body.events[0].status).toBe('pending')
    })

    it('adds a new event when status changes', async () => {
      const orderRes = await fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [{ productId: testProductId, quantity: 1 }],
        }),
      })
      const order = await orderRes.json()

      await fetch(`${BASE_URL}/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'paid' }),
      })

      const response = await fetch(`${BASE_URL}/orders/${order.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      const body = await response.json()

      expect(body.events.length).toBe(2)
      expect(body.events[1].status).toBe('paid')
    })
  })

  describe('GET /orders', () => {
    it('scopes a customer to only their own orders', async () => {
      const response = await fetch(`${BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.every((o: any) => o.customerId === testCustomerId)).toBe(true)
    })

    it('allows admin to filter by status', async () => {
      const response = await fetch(`${BASE_URL}/orders?status=pending`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.some((o: any) => o.id === testOrderId)).toBe(true)
    })
  })

  describe('PATCH /orders/:orderId', () => {
    it('rejects a customer role attempting a status transition', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ status: 'paid' }),
      })
      expect(response.status).toBe(403)
    })

    it('allows admin: pending -> paid', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'paid' }),
      })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('paid')
    })

    it('rejects paid -> delivered (illegal jump)', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'delivered' }),
      })
      expect(response.status).toBe(409)
    })

    it('allows admin: paid -> refunded', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'refunded' }),
      })
      expect(response.status).toBe(200)
    })

    it('rejects any transition out of a terminal status', async () => {
      const response = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'paid' }),
      })
      expect(response.status).toBe(409)
    })
  })
})