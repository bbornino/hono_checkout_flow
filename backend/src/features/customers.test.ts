import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { apiRequest, createTestUser } from '../testHelpers.js'

describe('Customers API', () => {
  let testCustomerId: number
  let testCustomerEmail: string
  let otherCustomerId: number
  let deletableCustomerId: number
  let adminToken: string
  let customerToken: string
  let deletableToken: string

  beforeAll(async () => {
    const customerRes = await apiRequest('/customers', {
      method: 'POST',
      body: {
        firstName: 'Test',
        lastName: 'User',
        email: `test-${Date.now()}@example.com`,
      },
    })
    const customer = await customerRes.json()
    testCustomerId = customer.id
    testCustomerEmail = customer.email

    const otherRes = await apiRequest('/customers', {
      method: 'POST',
      body: {
        firstName: 'Other',
        lastName: 'Customer',
        email: `other-${Date.now()}@example.com`,
      },
    })
    otherCustomerId = (await otherRes.json()).id

    const deletableRes = await apiRequest('/customers', {
      method: 'POST',
      body: {
        firstName: 'Deletable',
        lastName: 'Customer',
        email: `deletable-${Date.now()}@example.com`,
      },
    })
    const deletableCustomer = await deletableRes.json()
    deletableCustomerId = deletableCustomer.id

    adminToken = await createTestUser('admin')
    customerToken = await createTestUser('customer', testCustomerId, testCustomerEmail)
    deletableToken = await createTestUser('customer', deletableCustomerId, deletableCustomer.email)
  })

  afterAll(async () => {
    await apiRequest(`/customers/${testCustomerId}`, { method: 'DELETE', token: adminToken })
    await apiRequest(`/customers/${otherCustomerId}`, { method: 'DELETE', token: adminToken })
  })

  describe('POST /customers', () => {
    it('creates a customer with valid data, no auth required', async () => {
      const response = await apiRequest('/customers', {
        method: 'POST',
        body: {
          firstName: 'Guest',
          lastName: 'Checkout',
          email: `guest-${Date.now()}@example.com`,
        },
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.isGuest).toBe(true)
    })

    it('rejects a customer with an invalid email', async () => {
      const response = await apiRequest('/customers', {
        method: 'POST',
        body: { firstName: 'Test', lastName: 'User', email: 'not-an-email' },
      })

      expect(response.status).toBe(400)
    })
  })

  describe('GET /customers', () => {
    it('rejects a customer role from listing all customers', async () => {
      const response = await apiRequest('/customers', { token: customerToken })
      expect(response.status).toBe(403)
    })

    it('allows admin to list all customers', async () => {
      const response = await apiRequest('/customers', { token: adminToken })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(Array.isArray(body)).toBe(true)
    })

    it('rejects a request with no token', async () => {
      const response = await apiRequest('/customers')
      expect(response.status).toBe(401)
    })
  })

  describe('GET /customers/me', () => {
    it('returns the logged-in customer\'s own record', async () => {
      const response = await apiRequest('/customers/me', { token: customerToken })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe(testCustomerId)
    })

    it('rejects a request with no token', async () => {
      const response = await apiRequest('/customers/me')
      expect(response.status).toBe(401)
    })

    it('returns 404 for an account with no linked customer record', async () => {
      const response = await apiRequest('/customers/me', { token: adminToken })
      expect(response.status).toBe(404)
    })
  })

  describe('GET /customers/:customerId', () => {
    it('allows a customer to view their own record', async () => {
      const response = await apiRequest(`/customers/${testCustomerId}`, { token: customerToken })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe(testCustomerId)
    })

    it('rejects a customer viewing a record that is not theirs', async () => {
      const response = await apiRequest(`/customers/${otherCustomerId}`, { token: customerToken })
      expect(response.status).toBe(404)
    })

    it('allows admin to view any customer', async () => {
      const response = await apiRequest(`/customers/${otherCustomerId}`, { token: adminToken })
      expect(response.status).toBe(200)
    })

    it('returns 404 for a nonexistent customer', async () => {
      const response = await apiRequest('/customers/9999999', { token: adminToken })
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /customers/:customerId', () => {
    it('updates a single field on their own record', async () => {
      const response = await apiRequest(`/customers/${testCustomerId}`, {
        method: 'PATCH',
        token: customerToken,
        body: { lastName: 'Updated' },
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.lastName).toBe('Updated')
      expect(body.firstName).toBe('Test')
    })

    it('rejects a customer updating a record that is not theirs', async () => {
      const response = await apiRequest(`/customers/${otherCustomerId}`, {
        method: 'PATCH',
        token: customerToken,
        body: { lastName: 'Hijacked' },
      })

      expect(response.status).toBe(404)
    })

    it('rejects an empty body', async () => {
      const response = await apiRequest(`/customers/${testCustomerId}`, {
        method: 'PATCH',
        token: customerToken,
        body: {},
      })

      expect(response.status).toBe(400)
    })

    it('rejects invalid data', async () => {
      const response = await apiRequest(`/customers/${testCustomerId}`, {
        method: 'PATCH',
        token: customerToken,
        body: { email: 'not-an-email' },
      })

      expect(response.status).toBe(400)
    })

    it('updates email on both customers and the linked users table', async () => {
      const newEmail = `updated-${Date.now()}@example.com`

      const patchResponse = await apiRequest(`/customers/${testCustomerId}`, {
        method: 'PATCH',
        token: customerToken,
        body: { email: newEmail },
      })

      expect(patchResponse.status).toBe(200)
      const body = await patchResponse.json()
      expect(body.email).toBe(newEmail)

      const loginResponse = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: newEmail, password: 'customer' },
      })

      expect(loginResponse.status).toBe(200)
      const loginBody = await loginResponse.json()
      expect(loginBody.token).toBeTruthy()

      testCustomerEmail = newEmail
    })
  })

  describe('DELETE /customers/:customerId', () => {
    it('rejects a customer deleting a record that is not theirs', async () => {
      const response = await apiRequest(`/customers/${otherCustomerId}`, {
        method: 'DELETE',
        token: deletableToken,
      })

      expect(response.status).toBe(404)
    })

    it('returns 404 for a nonexistent customer', async () => {
      const response = await apiRequest('/customers/9999999', {
        method: 'DELETE',
        token: adminToken,
      })

      expect(response.status).toBe(404)
    })

    it('deletes their own record', async () => {
      const response = await apiRequest(`/customers/${deletableCustomerId}`, {
        method: 'DELETE',
        token: deletableToken,
      })

      expect(response.status).toBe(200)
    })
  })
})