import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { apiRequest, createTestUser } from '../testHelpers.js'

describe('Addresses API', () => {
  let testCustomerId: number
  let testAddressId: number
  let otherCustomerId: number
  let otherAddressId: number
  let adminToken: string
  let customerToken: string

  beforeAll(async () => {
    const customerRes = await apiRequest('/customers', {
      method: 'POST',
      body: {
        firstName: 'Address',
        lastName: 'Tester',
        email: `address-test-${Date.now()}@example.com`,
      },
    })
    const customer = await customerRes.json()
    testCustomerId = customer.id

    adminToken = await createTestUser('admin')
    customerToken = await createTestUser('customer', testCustomerId, customer.email)

    const addressRes = await apiRequest('/addresses', {
      method: 'POST',
      token: customerToken,
      body: {
        label: 'Home',
        addressLine1: '555 Main Street',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '95111',
        country: 'US',
      },
    })
    testAddressId = (await addressRes.json()).id

    const otherCustomerRes = await apiRequest('/customers', {
      method: 'POST',
      body: {
        firstName: 'Other',
        lastName: 'Customer',
        email: `other-customer-${Date.now()}@example.com`,
      },
    })
    otherCustomerId = (await otherCustomerRes.json()).id

    const otherAddressRes = await apiRequest('/addresses', {
      method: 'POST',
      token: adminToken,
      body: {
        customerId: otherCustomerId,
        label: 'Not Yours',
        addressLine1: '999 Other St',
        city: 'Elsewhere',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
      },
    })
    otherAddressId = (await otherAddressRes.json()).id
  })

  afterAll(async () => {
    await apiRequest(`/customers/${testCustomerId}`, { method: 'DELETE' })
    await apiRequest(`/customers/${otherCustomerId}`, { method: 'DELETE' })
  })

  describe('POST /addresses', () => {
    it('creates an address as a customer, ignoring their own customerId ownership', async () => {
      const response = await apiRequest('/addresses', {
        method: 'POST',
        token: customerToken,
        body: {
          label: 'Work',
          addressLine1: '1 Office Way',
          city: 'Metropolis',
          state: 'NY',
          postalCode: '10002',
          country: 'US',
        },
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.customerId).toBe(testCustomerId)
    })

    it('rejects an address with an invalid country', async () => {
      const response = await apiRequest('/addresses', {
        method: 'POST',
        token: customerToken,
        body: {
          addressLine1: '555 Main Street',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '95111',
          country: 'USA',
        },
      })

      expect(response.status).toBe(400)
    })

    it('rejects a request with no token', async () => {
      const response = await apiRequest('/addresses', {
        method: 'POST',
        body: {
          addressLine1: '555 Main Street',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '95111',
          country: 'US',
        },
      })

      expect(response.status).toBe(401)
    })
  })

  describe('GET /addresses', () => {
    it('scopes a customer to only their own addresses', async () => {
      const response = await apiRequest('/addresses', { token: customerToken })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.every((a: any) => a.customerId === testCustomerId)).toBe(true)
    })

    it('allows admin to see all addresses', async () => {
      const response = await apiRequest('/addresses', { token: adminToken })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.some((a: any) => a.id === otherAddressId)).toBe(true)
    })
  })

  describe('GET /addresses/:addressId', () => {
    it('allows a customer to view their own address', async () => {
      const response = await apiRequest(`/addresses/${testAddressId}`, { token: customerToken })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe(testAddressId)
    })

    it('rejects a customer viewing an address that is not theirs', async () => {
      const response = await apiRequest(`/addresses/${otherAddressId}`, { token: customerToken })
      expect(response.status).toBe(404)
    })

    it('allows admin to view any address', async () => {
      const response = await apiRequest(`/addresses/${otherAddressId}`, { token: adminToken })
      expect(response.status).toBe(200)
    })

    it('returns 404 for a nonexistent address', async () => {
      const response = await apiRequest('/addresses/9999999', { token: adminToken })
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /addresses/:addressId', () => {
    it('updates a single field on their own address', async () => {
      const response = await apiRequest(`/addresses/${testAddressId}`, {
        method: 'PATCH',
        token: customerToken,
        body: { addressLine1: 'Updated' },
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.addressLine1).toBe('Updated')
    })

    it('rejects a customer updating an address that is not theirs', async () => {
      const response = await apiRequest(`/addresses/${otherAddressId}`, {
        method: 'PATCH',
        token: customerToken,
        body: { addressLine1: 'Hijacked' },
      })

      expect(response.status).toBe(404)
    })

    it('rejects an empty body', async () => {
      const response = await apiRequest(`/addresses/${testAddressId}`, {
        method: 'PATCH',
        token: customerToken,
        body: {},
      })

      expect(response.status).toBe(400)
    })

    it('rejects an attempt to change customerId', async () => {
      const response = await apiRequest(`/addresses/${testAddressId}`, {
        method: 'PATCH',
        token: customerToken,
        body: { customerId: 99999 },
      })

      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /addresses/:addressId', () => {
    it('rejects a customer deleting an address that is not theirs', async () => {
      const response = await apiRequest(`/addresses/${otherAddressId}`, {
        method: 'DELETE',
        token: customerToken,
      })

      expect(response.status).toBe(404)
    })

    it('returns 404 for a nonexistent address', async () => {
      const response = await apiRequest('/addresses/9999999', {
        method: 'DELETE',
        token: adminToken,
      })

      expect(response.status).toBe(404)
    })

    it('deletes their own address', async () => {
      const response = await apiRequest(`/addresses/${testAddressId}`, {
        method: 'DELETE',
        token: customerToken,
      })

      expect(response.status).toBe(200)
    })
  })
})