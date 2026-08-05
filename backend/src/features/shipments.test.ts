import { describe, it, expect, beforeAll } from 'vitest'
import { apiRequest, createTestUser } from '../testHelpers.js'

describe('Shipments API', () => {
  let testCustomerId: number
  let testCustomerEmail: string
  let testAddressId: number
  let testProductId: number
  let testOrderId: number
  let testShipmentId: number
  let otherOrderId: number
  let adminToken: string
  let customerToken: string

  beforeAll(async () => {
    adminToken = await createTestUser('admin')

    const customerRes = await apiRequest('/customers', {
      method: 'POST',
      body: {
        firstName: 'Shipment',
        lastName: 'Tester',
        email: `shipment-test-${Date.now()}@example.com`,
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
        addressLine1: '123 Shipment St',
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
        sku: `SHIPMENT-TEST-${Date.now()}`,
        name: 'Shipment Test Product',
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
    it('rejects GET /shipments with no token', async () => {
      const response = await apiRequest('/shipments')
      expect(response.status).toBe(401)
    })

    it('rejects a customer role from listing all shipments', async () => {
      const response = await apiRequest('/shipments', { token: customerToken })
      expect(response.status).toBe(403)
    })

    it('allows admin to list all shipments', async () => {
      const response = await apiRequest('/shipments', { token: adminToken })
      expect(response.status).toBe(200)
    })
  })

  describe('POST /shipments', () => {
    it('creates a shipment for their own order without shippedAt/deliveredAt', async () => {
      const response = await apiRequest('/shipments', {
        method: 'POST',
        token: customerToken,
        body: {
          orderId: testOrderId,
          carrier: 'UPS',
          trackingNumber: '1Z999AA10123456784',
        },
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.shippedAt).toBeNull()
      expect(body.deliveredAt).toBeNull()
      testShipmentId = body.id
    })

    it('allows admin to create a shipment for any order', async () => {
      const response = await apiRequest('/shipments', {
        method: 'POST',
        token: adminToken,
        body: {
          orderId: testOrderId,
          carrier: 'UPS',
          trackingNumber: '1Z999AA10123456785',
        },
      })

      expect(response.status).toBe(201)
    })

    it('rejects a customer creating a shipment for an order that is not theirs', async () => {
      const response = await apiRequest('/shipments', {
        method: 'POST',
        token: customerToken,
        body: {
          orderId: otherOrderId + 999999,
          carrier: 'UPS',
          trackingNumber: '1Z999AA10123456786',
        },
      })

      expect(response.status).toBe(400)
    })

    it('rejects a shipment with a nonexistent orderId', async () => {
      const response = await apiRequest('/shipments', {
        method: 'POST',
        token: customerToken,
        body: {
          orderId: 9999999,
          carrier: 'UPS',
          trackingNumber: '1Z999AA10123456787',
        },
      })

      expect(response.status).toBe(400)
    })

    it('ignores an attempt to set deliveredAt on create', async () => {
      const response = await apiRequest('/shipments', {
        method: 'POST',
        token: customerToken,
        body: {
          orderId: testOrderId,
          carrier: 'FedEx',
          trackingNumber: '999999999999',
          deliveredAt: new Date().toISOString(),
        },
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.deliveredAt).toBeNull()
    })
  })

  describe('GET /shipments/:shipmentId', () => {
    it('allows a customer to view a shipment on their own order', async () => {
      const response = await apiRequest(`/shipments/${testShipmentId}`, { token: customerToken })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe(testShipmentId)
    })

    it('allows admin to view any shipment', async () => {
      const response = await apiRequest(`/shipments/${testShipmentId}`, { token: adminToken })
      expect(response.status).toBe(200)
    })

    it('returns 404 for a nonexistent shipment', async () => {
      const response = await apiRequest('/shipments/9999999', { token: adminToken })
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /shipments/:shipmentId', () => {
    it('rejects a customer role from updating a shipment', async () => {
      const response = await apiRequest(`/shipments/${testShipmentId}`, {
        method: 'PATCH',
        token: customerToken,
        body: { deliveredAt: new Date().toISOString() },
      })

      expect(response.status).toBe(403)
    })

    it('allows admin to update just deliveredAt', async () => {
      const response = await apiRequest(`/shipments/${testShipmentId}`, {
        method: 'PATCH',
        token: adminToken,
        body: { deliveredAt: new Date().toISOString() },
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.deliveredAt).not.toBeNull()
      expect(body.carrier).toBe('UPS')
    })

    it('rejects an empty body', async () => {
      const response = await apiRequest(`/shipments/${testShipmentId}`, {
        method: 'PATCH',
        token: adminToken,
        body: {},
      })

      expect(response.status).toBe(400)
    })
  })
})