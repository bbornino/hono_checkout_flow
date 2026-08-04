import { describe, it, expect, beforeAll } from 'vitest'
import { apiRequest, createTestUser } from '../testHelpers.js'

describe('Payments API', () => {
  let testCustomerId: number
  let testCustomerEmail: string
  let testAddressId: number
  let testProductId: number
  let testOrderId: number
  let testPaymentId: number
  let otherOrderId: number
  let adminToken: string
  let customerToken: string

  beforeAll(async () => {
    adminToken = await createTestUser('admin')

    const customerRes = await apiRequest('/customers', {
      method: 'POST',
      body: {
        firstName: 'Payment',
        lastName: 'Tester',
        email: `payment-test-${Date.now()}@example.com`,
      },
    })
    const customer = await customerRes.json()
    testCustomerId = customer.id
    testCustomerEmail = customer.email

    customerToken = await createTestUser('customer', testCustomerId, testCustomerEmail)

    const addressRes = await apiRequest('/addresses', {
      method: 'POST',
      token: customerToken,
      body: {
        addressLine1: '123 Payment St',
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
        sku: `PAYMENT-TEST-${Date.now()}`,
        name: 'Payment Test Product',
        priceCents: 1000,
        weightOz: 5,
      },
    })
    testProductId = (await productRes.json()).id

    const orderRes = await apiRequest('/orders', {
      method: 'POST',
      token: customerToken,
      body: {
        shippingAddressId: testAddressId,
        billingAddressId: testAddressId,
        items: [{ productId: testProductId, quantity: 1 }],
      },
    })
    testOrderId = (await orderRes.json()).id

    const otherOrderRes = await apiRequest('/orders', {
      method: 'POST',
      token: adminToken,
      body: {
        customerId: testCustomerId,
        shippingAddressId: testAddressId,
        billingAddressId: testAddressId,
        items: [{ productId: testProductId, quantity: 1 }],
      },
    })
    otherOrderId = (await otherOrderRes.json()).id
  })

  describe('Auth protection', () => {
    it('rejects GET /payments with no token', async () => {
      const response = await apiRequest('/payments')
      expect(response.status).toBe(401)
    })

    it('rejects a customer role from listing all payments', async () => {
      const response = await apiRequest('/payments', { token: customerToken })
      expect(response.status).toBe(403)
    })

    it('allows admin to list all payments', async () => {
      const response = await apiRequest('/payments', { token: adminToken })
      expect(response.status).toBe(200)
    })
  })

  describe('POST /payments', () => {
    it('creates a payment for their own order, defaulting to pending', async () => {
      const response = await apiRequest('/payments', {
        method: 'POST',
        token: customerToken,
        body: { orderId: testOrderId, amountCents: 1080, method: 'card' },
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.status).toBe('pending')
      testPaymentId = body.id
    })

    it('allows admin to create a payment for any order', async () => {
      const response = await apiRequest('/payments', {
        method: 'POST',
        token: adminToken,
        body: { orderId: testOrderId, amountCents: 1080, method: 'card' },
      })

      expect(response.status).toBe(201)
    })

    it('rejects a customer creating a payment for an order that is not theirs', async () => {
      const response = await apiRequest('/payments', {
        method: 'POST',
        token: customerToken,
        body: { orderId: otherOrderId + 999999, amountCents: 1080, method: 'card' },
      })

      expect(response.status).toBe(400)
    })

    it('rejects a payment with a nonexistent orderId', async () => {
      const response = await apiRequest('/payments', {
        method: 'POST',
        token: customerToken,
        body: { orderId: 9999999, amountCents: 1080, method: 'card' },
      })

      expect(response.status).toBe(400)
    })

    it('ignores an attempt to set status on create', async () => {
      const response = await apiRequest('/payments', {
        method: 'POST',
        token: customerToken,
        body: { orderId: testOrderId, amountCents: 1080, method: 'card', status: 'succeeded' },
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.status).toBe('pending')
    })
  })

  describe('GET /payments/:paymentId', () => {
    it('allows a customer to view a payment on their own order', async () => {
      const response = await apiRequest(`/payments/${testPaymentId}`, { token: customerToken })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe(testPaymentId)
    })

    it('allows admin to view any payment', async () => {
      const response = await apiRequest(`/payments/${testPaymentId}`, { token: adminToken })
      expect(response.status).toBe(200)
    })

    it('returns 404 for a nonexistent payment', async () => {
      const response = await apiRequest('/payments/9999999', { token: adminToken })
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /payments/:paymentId', () => {
    it('rejects a customer role from updating a payment', async () => {
      const response = await apiRequest(`/payments/${testPaymentId}`, {
        method: 'PATCH',
        token: customerToken,
        body: { status: 'succeeded' },
      })

      expect(response.status).toBe(403)
    })

    it('allows admin to mark a payment as succeeded with a processedAt timestamp', async () => {
      const response = await apiRequest(`/payments/${testPaymentId}`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'succeeded', processedAt: new Date().toISOString() },
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('succeeded')
    })

    it('rejects an empty body', async () => {
      const response = await apiRequest(`/payments/${testPaymentId}`, {
        method: 'PATCH',
        token: adminToken,
        body: {},
      })

      expect(response.status).toBe(400)
    })
  })
})