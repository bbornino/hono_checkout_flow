import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { BASE_URL } from '../constants.js'

describe('Shipments API', () => {
  let testCustomerId: number
  let testAddressId: number
  let testProductId: number
  let testOrderId: number
  let testShipmentId: number

  beforeAll(async () => {
    const customerRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Shipment',
        lastName: 'Tester',
        email: `shipment-test-${Date.now()}@example.com`,
      }),
    })
    testCustomerId = (await customerRes.json()).id

    const addressRes = await fetch(`${BASE_URL}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        addressLine1: '123 Shipment St',
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
        sku: `SHIPMENT-TEST-${Date.now()}`,
        name: 'Shipment Test Product',
        priceCents: 1000,
        weightOz: 5,
      }),
    })
    testProductId = (await productRes.json()).id

  const adminEmail = `shipment-admin-${Date.now()}@example.com`
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
  const adminToken = (await adminLoginRes.json()).token

  const orderRes = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
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

  describe('POST /shipments', () => {
    it('creates a shipment without shippedAt/deliveredAt', async () => {
      const response = await fetch(`${BASE_URL}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: testOrderId,
          carrier: 'UPS',
          trackingNumber: '1Z999AA10123456784',
        }),
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.shippedAt).toBeNull()
      expect(body.deliveredAt).toBeNull()
      testShipmentId = body.id
    })

    it('rejects a shipment with a nonexistent orderId', async () => {
      const response = await fetch(`${BASE_URL}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 9999999,
          carrier: 'UPS',
          trackingNumber: '1Z999AA10123456784',
        }),
      })

      expect(response.status).toBe(400)
    })

    it('ignores an attempt to set deliveredAt on create', async () => {
      const response = await fetch(`${BASE_URL}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: testOrderId,
          carrier: 'FedEx',
          trackingNumber: '999999999999',
          deliveredAt: new Date().toISOString(),
        }),
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.deliveredAt).toBeNull()
    })
  })

  describe('GET /shipments/:shipmentId', () => {
    it('returns the matching shipment', async () => {
      const response = await fetch(`${BASE_URL}/shipments/${testShipmentId}`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe(testShipmentId)
    })

    it('returns 404 for a nonexistent shipment', async () => {
      const response = await fetch(`${BASE_URL}/shipments/9999999`)
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /shipments/:shipmentId', () => {
    it('updates just deliveredAt', async () => {
      const response = await fetch(`${BASE_URL}/shipments/${testShipmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveredAt: new Date().toISOString(),
        }),
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.deliveredAt).not.toBeNull()
      expect(body.carrier).toBe('UPS')
    })

    it('rejects an empty body', async () => {
      const response = await fetch(`${BASE_URL}/shipments/${testShipmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
    })
  })
})