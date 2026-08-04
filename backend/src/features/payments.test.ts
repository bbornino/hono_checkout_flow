import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { apiRequest, createTestUser } from '../testHelpers.js'

describe('Payments API', () => {
  let testCustomerId: number
  let testAddressId: number
  let testProductId: number
  let testOrderId: number
  let testPaymentId: number

  beforeAll(async () => {
    const customerRes = await apiRequest('/customers', {
      method: 'POST',
      body: {
        firstName: 'Payment',
        lastName: 'Tester',
        email: `payment-test-${Date.now()}@example.com`,
      },
    })
    testCustomerId = (await customerRes.json()).id

    const adminToken = await createTestUser('admin')

    const addressRes = await apiRequest('/addresses', {
      method: 'POST',
      token: adminToken,
      body: {
        customerId: testCustomerId,
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
      token: adminToken,
      body: {
        customerId: testCustomerId,
        shippingAddressId: testAddressId,
        billingAddressId: testAddressId,
        items: [{ productId: testProductId, quantity: 1 }],
      },
    })
    testOrderId = (await orderRes.json()).id
  })

  afterAll(async () => {
    await apiRequest(`/products/${testProductId}`, { method: 'DELETE' })
    await apiRequest(`/addresses/${testAddressId}`, { method: 'DELETE' })
    await apiRequest(`/customers/${testCustomerId}`, { method: 'DELETE' })
  })

  describe('POST /payments', () => {
    it('creates a payment defaulting to pending status', async () => {
      const response = await apiRequest('/payments', {
        method: 'POST',
        body: { orderId: testOrderId, amountCents: 1080, method: 'card' },
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.status).toBe('pending')
      testPaymentId = body.id
    })

    it('rejects a payment with a nonexistent orderId', async () => {
      const response = await apiRequest('/payments', {
        method: 'POST',
        body: { orderId: 9999999, amountCents: 1080, method: 'card' },
      })

      expect(response.status).toBe(400)
    })

    it('rejects an attempt to set status on create', async () => {
      const response = await apiRequest('/payments', {
        method: 'POST',
        body: { orderId: testOrderId, amountCents: 1080, method: 'card', status: 'succeeded' },
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.status).toBe('pending')
    })
  })

  describe('GET /payments/:paymentId', () => {
    it('returns the matching payment', async () => {
      const response = await apiRequest(`/payments/${testPaymentId}`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe(testPaymentId)
    })

    it('returns 404 for a nonexistent payment', async () => {
      const response = await apiRequest('/payments/9999999')
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /payments/:paymentId', () => {
    it('marks a payment as succeeded with a processedAt timestamp', async () => {
      const response = await apiRequest(`/payments/${testPaymentId}`, {
        method: 'PATCH',
        body: { status: 'succeeded', processedAt: new Date().toISOString() },
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('succeeded')
    })

    it('rejects an empty body', async () => {
      const response = await apiRequest(`/payments/${testPaymentId}`, {
        method: 'PATCH',
        body: {},
      })

      expect(response.status).toBe(400)
    })
  })
})