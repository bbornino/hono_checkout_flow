import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { apiRequest, createTestUser } from '../testHelpers.js'

describe('Orders API', () => {
  let testCustomerId: number
  let testAddressId: number
  let testProductId: number
  let testOrderId: number
  let adminToken: string
  let customerToken: string

  beforeAll(async () => {
    const customerRes = await apiRequest('/customers', {
      method: 'POST',
      body: {
        firstName: 'Order',
        lastName: 'Tester',
        email: `order-test-${Date.now()}@example.com`,
      },
    })
    const customer = await customerRes.json()
    testCustomerId = customer.id

    adminToken = await createTestUser('admin')

    const addressRes = await apiRequest('/addresses', {
      method: 'POST',
      token: adminToken,
      body: {
        customerId: testCustomerId,
        addressLine1: '123 Test St',
        city: 'Testville',
        state: 'CA',
        postalCode: '90210',
        country: 'US',
      },
    })
    testAddressId = (await addressRes.json()).id

    const productRes = await apiRequest('/products', {
      method: 'POST',
      body: {
        sku: `ORDER-TEST-${Date.now()}`,
        name: 'Order Test Product',
        priceCents: 1000,
        weightOz: 5,
      },
    })
    testProductId = (await productRes.json()).id

    customerToken = await createTestUser('customer', testCustomerId, customer.email)
  })

  afterAll(async () => {
    await apiRequest(`/products/${testProductId}`, { method: 'DELETE' })
    await apiRequest(`/addresses/${testAddressId}`, { method: 'DELETE', token: adminToken })
    await apiRequest(`/customers/${testCustomerId}`, { method: 'DELETE', token: adminToken })
  })

  describe('Auth protection', () => {
    it('rejects GET /orders with no token', async () => {
      const response = await apiRequest('/orders')
      expect(response.status).toBe(401)
    })

    it('rejects POST /orders with no token', async () => {
      const response = await apiRequest('/orders', {
        method: 'POST',
        body: {
          customerId: testCustomerId,
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [{ productId: testProductId, quantity: 1 }],
        },
      })
      expect(response.status).toBe(401)
    })
  })

  describe('POST /orders', () => {
    it('creates an order as a customer, ignoring a spoofed customerId', async () => {
      const response = await apiRequest('/orders', {
        method: 'POST',
        token: customerToken,
        body: {
          customerId: 999999,
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [{ productId: testProductId, quantity: 3 }],
        },
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.customerId).toBe(testCustomerId)
      expect(body.subtotalCents).toBe(3000)
      testOrderId = body.id
    })

    it('allows admin to place an order on behalf of a customer', async () => {
      const response = await apiRequest('/orders', {
        method: 'POST',
        token: adminToken,
        body: {
          customerId: testCustomerId,
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [{ productId: testProductId, quantity: 1 }],
        },
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.customerId).toBe(testCustomerId)
    })

    it('rejects an order with a nonexistent productId', async () => {
      const response = await apiRequest('/orders', {
        method: 'POST',
        token: customerToken,
        body: {
          customerId: testCustomerId,
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [{ productId: 9999999, quantity: 1 }],
        },
      })
      expect(response.status).toBe(400)
    })

    it('rejects an order with an empty items array', async () => {
      const response = await apiRequest('/orders', {
        method: 'POST',
        token: customerToken,
        body: {
          customerId: testCustomerId,
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [],
        },
      })
      expect(response.status).toBe(400)
    })

    it('applies a valid discount code to the order total', async () => {
      const discountCode = `ORDER-DISCOUNT-${Date.now()}`
      await apiRequest('/discounts', {
        method: 'POST',
        token: adminToken,
        body: {
          code: discountCode,
          description: 'Order test discount',
          discountType: 'fixed',
          fixedCents: 500,
          validFrom: '2026-01-01T00:00:00.000Z',
          validUntil: '2026-12-31T00:00:00.000Z',
        },
      })

      const response = await apiRequest('/orders', {
        method: 'POST',
        token: customerToken,
        body: {
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          discountCode,
          items: [{ productId: testProductId, quantity: 1 }],
        },
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.discountCents).toBe(500)
      expect(body.totalCents).toBe(body.subtotalCents + body.taxCents + body.shippingCents - 500)
    })

    it('rejects an order with an invalid discount code', async () => {
      const response = await apiRequest('/orders', {
        method: 'POST',
        token: customerToken,
        body: {
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          discountCode: 'NOT-A-REAL-CODE',
          items: [{ productId: testProductId, quantity: 1 }],
        },
      })

      expect(response.status).toBe(400)
    })
  })

  describe('GET /orders/:orderId', () => {
    it('allows a customer to view their own order', async () => {
      const response = await apiRequest(`/orders/${testOrderId}`, { token: customerToken })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.items.length).toBe(1)
      expect(body.items[0].productName).toBe('Order Test Product')
    })

    it('allows admin to view any order', async () => {
      const response = await apiRequest(`/orders/${testOrderId}`, { token: adminToken })
      expect(response.status).toBe(200)
    })

    it('rejects a customer viewing an order that is not theirs', async () => {
      const response = await apiRequest('/orders/1', { token: customerToken })
      expect(response.status).toBe(404)
    })

    it('returns 404 for a nonexistent order', async () => {
      const response = await apiRequest('/orders/9999999', { token: adminToken })
      expect(response.status).toBe(404)
    })

    it('returns the order with its status event history', async () => {
      const response = await apiRequest(`/orders/${testOrderId}`, { token: customerToken })
      const body = await response.json()
      expect(body.events.length).toBeGreaterThanOrEqual(1)
      expect(body.events[0].status).toBe('pending')
    })

    it('adds a new event when status changes', async () => {
      const orderRes = await apiRequest('/orders', {
        method: 'POST',
        token: customerToken,
        body: {
          shippingAddressId: testAddressId,
          billingAddressId: testAddressId,
          items: [{ productId: testProductId, quantity: 1 }],
        },
      })
      const order = await orderRes.json()

      await apiRequest(`/orders/${order.id}`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'paid' },
      })

      const response = await apiRequest(`/orders/${order.id}`, { token: adminToken })
      const body = await response.json()

      expect(body.events.length).toBe(2)
      expect(body.events[1].status).toBe('paid')
    })
  })

  describe('GET /orders', () => {
    it('scopes a customer to only their own orders', async () => {
      const response = await apiRequest('/orders', { token: customerToken })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.every((o: any) => o.customerId === testCustomerId)).toBe(true)
    })

    it('allows admin to filter by status', async () => {
      const response = await apiRequest('/orders?status=pending', { token: adminToken })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.some((o: any) => o.id === testOrderId)).toBe(true)
    })
  })

  describe('PATCH /orders/:orderId', () => {
    it('rejects a customer role attempting a status transition', async () => {
      const response = await apiRequest(`/orders/${testOrderId}`, {
        method: 'PATCH',
        token: customerToken,
        body: { status: 'paid' },
      })
      expect(response.status).toBe(403)
    })

    it('allows admin: pending -> paid', async () => {
      const response = await apiRequest(`/orders/${testOrderId}`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'paid' },
      })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('paid')
    })

    it('rejects paid -> delivered (illegal jump)', async () => {
      const response = await apiRequest(`/orders/${testOrderId}`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'delivered' },
      })
      expect(response.status).toBe(409)
    })

    it('allows admin: paid -> refunded', async () => {
      const response = await apiRequest(`/orders/${testOrderId}`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'refunded' },
      })
      expect(response.status).toBe(200)
    })

    it('rejects any transition out of a terminal status', async () => {
      const response = await apiRequest(`/orders/${testOrderId}`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'paid' },
      })
      expect(response.status).toBe(409)
    })
  })
})