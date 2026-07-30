import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { BASE_URL } from '../constants.js'

describe('Payments API', () => {
  let testCustomerId: number
  let testAddressId: number
  let testProductId: number
  let testOrderId: number
  let testPaymentId: number

  beforeAll(async () => {
    const customerRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Payment',
        lastName: 'Tester',
        email: `payment-test-${Date.now()}@example.com`,
      }),
    })
    testCustomerId = (await customerRes.json()).id

    const addressRes = await fetch(`${BASE_URL}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        addressLine1: '123 Payment St',
        city: 'Testville',
        state: 'CA',
        postalCode: '90210',
        country: 'US',
      }),
    })
    testAddressId = (await addressRes.json()).id

    const productRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: `PAYMENT-TEST-${Date.now()}`,
        name: 'Payment Test Product',
        priceCents: 1000,
        weightOz: 5,
      }),
    })
    testProductId = (await productRes.json()).id

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
    testOrderId = (await orderRes.json()).id
  })

  afterAll(async () => {
    await fetch(`${BASE_URL}/products/${testProductId}`, { method: 'DELETE' })
    await fetch(`${BASE_URL}/addresses/${testAddressId}`, { method: 'DELETE' })
    await fetch(`${BASE_URL}/customers/${testCustomerId}`, { method: 'DELETE' })
  })

  describe('POST /payments', () => {
    it('creates a payment defaulting to pending status', async () => {
      const response = await fetch(`${BASE_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: testOrderId,
          amountCents: 1080,
          method: 'card',
        }),
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.status).toBe('pending')
      testPaymentId = body.id
    })

    it('rejects a payment with a nonexistent orderId', async () => {
      const response = await fetch(`${BASE_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 9999999,
          amountCents: 1080,
          method: 'card',
        }),
      })

      expect(response.status).toBe(400)
    })

    it('rejects an attempt to set status on create', async () => {
      const response = await fetch(`${BASE_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: testOrderId,
          amountCents: 1080,
          method: 'card',
          status: 'succeeded',
        }),
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.status).toBe('pending')
    })
  })

  describe('GET /payments/:paymentId', () => {
    it('returns the matching payment', async () => {
      const response = await fetch(`${BASE_URL}/payments/${testPaymentId}`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe(testPaymentId)
    })

    it('returns 404 for a nonexistent payment', async () => {
      const response = await fetch(`${BASE_URL}/payments/9999999`)
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /payments/:paymentId', () => {
    it('marks a payment as succeeded with a processedAt timestamp', async () => {
      const response = await fetch(`${BASE_URL}/payments/${testPaymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'succeeded',
          processedAt: new Date().toISOString(),
        }),
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('succeeded')
    })

    it('rejects an empty body', async () => {
      const response = await fetch(`${BASE_URL}/payments/${testPaymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
    })
  })
})