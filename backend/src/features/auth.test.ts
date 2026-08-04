import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { apiRequest, createTestUser } from '../testHelpers.js'

describe('Auth API', () => {
  let adminToken: string
  let linkableCustomerId: number
  let linkableCustomerEmail: string
  let unlinkedCustomerId: number
  let unlinkedCustomerEmail: string

  beforeAll(async () => {
    adminToken = await createTestUser('admin')

    const linkableRes = await apiRequest('/customers', {
      method: 'POST',
      body: {
        firstName: 'Linkable',
        lastName: 'Customer',
        email: `linkable-${Date.now()}@example.com`,
      },
    })
    const linkableCustomer = await linkableRes.json()
    linkableCustomerId = linkableCustomer.id
    linkableCustomerEmail = linkableCustomer.email

    const unlinkedRes = await apiRequest('/customers', {
      method: 'POST',
      body: {
        firstName: 'Unlinked',
        lastName: 'Customer',
        email: `unlinked-${Date.now()}@example.com`,
      },
    })
    const unlinkedCustomer = await unlinkedRes.json()
    unlinkedCustomerId = unlinkedCustomer.id
    unlinkedCustomerEmail = unlinkedCustomer.email
  })

  afterAll(async () => {
    await apiRequest(`/customers/${linkableCustomerId}`, { method: 'DELETE', token: adminToken })
    await apiRequest(`/customers/${unlinkedCustomerId}`, { method: 'DELETE', token: adminToken })
  })

  describe('POST /auth/signup', () => {
    it('creates an admin account with no linked customer', async () => {
      const response = await apiRequest('/auth/signup', {
        method: 'POST',
        body: {
          email: `signup-admin-${Date.now()}@example.com`,
          password: 'admin',
          role: 'admin',
        },
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.role).toBe('admin')
      expect(body.passwordHash).toBeUndefined()
    })

    it('creates a brand-new customer account and customer record together', async () => {
      const response = await apiRequest('/auth/signup', {
        method: 'POST',
        body: {
          email: `signup-new-${Date.now()}@example.com`,
          password: 'customer',
          role: 'customer',
          firstName: 'Brand',
          lastName: 'New',
        },
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.role).toBe('customer')
      expect(body.passwordHash).toBeUndefined()
    })

    it('rejects a new customer signup missing firstName/lastName', async () => {
      const response = await apiRequest('/auth/signup', {
        method: 'POST',
        body: {
          email: `signup-incomplete-${Date.now()}@example.com`,
          password: 'customer',
          role: 'customer',
        },
      })

      expect(response.status).toBe(400)
    })

    it('links to an existing customer when the email matches', async () => {
      const response = await apiRequest('/auth/signup', {
        method: 'POST',
        body: {
          email: linkableCustomerEmail,
          password: 'customer',
          role: 'customer',
          existingCustomerId: linkableCustomerId,
        },
      })

      expect(response.status).toBe(201)
    })

    it('rejects linking to an existing customer when the email does not match', async () => {
      const response = await apiRequest('/auth/signup', {
        method: 'POST',
        body: {
          email: `wrong-email-${Date.now()}@example.com`,
          password: 'customer',
          role: 'customer',
          existingCustomerId: unlinkedCustomerId,
        },
      })

      expect(response.status).toBe(400)
    })

    it('rejects linking to a customer that is already linked to another account', async () => {
      const response = await apiRequest('/auth/signup', {
        method: 'POST',
        body: {
          email: linkableCustomerEmail,
          password: 'customer',
          role: 'customer',
          existingCustomerId: linkableCustomerId,
        },
      })

      expect(response.status).toBe(400)
    })

    it('rejects linking to a nonexistent customerId', async () => {
      const response = await apiRequest('/auth/signup', {
        method: 'POST',
        body: {
          email: `no-such-customer-${Date.now()}@example.com`,
          password: 'customer',
          role: 'customer',
          existingCustomerId: 9999999,
        },
      })

      expect(response.status).toBe(400)
    })
  })

  describe('POST /auth/login', () => {
    it('logs in with valid credentials and returns a real token', async () => {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: linkableCustomerEmail, password: 'customer' },
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(typeof body.token).toBe('string')
      expect(body.token.split('.').length).toBe(3)
    })

    it('rejects an unknown email with a generic message', async () => {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: 'nobody@example.com', password: 'whatever' },
      })

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Invalid email or password')
    })

    it('rejects a wrong password with the same generic message', async () => {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: linkableCustomerEmail, password: 'totally-wrong' },
      })

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Invalid email or password')
    })
  })

  describe('PATCH /auth/password', () => {
    it('rejects a request with no token', async () => {
      const response = await apiRequest('/auth/password', {
        method: 'PATCH',
        body: { currentPassword: 'customer', newPassword: 'newone' },
      })

      expect(response.status).toBe(401)
    })

    it('rejects the wrong current password', async () => {
      const loginRes = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: linkableCustomerEmail, password: 'customer' },
      })
      const token = (await loginRes.json()).token

      const response = await apiRequest('/auth/password', {
        method: 'PATCH',
        token,
        body: { currentPassword: 'wrong-password', newPassword: 'newone' },
      })

      expect(response.status).toBe(401)
    })

    it('changes the password and allows login with the new one', async () => {
      const loginRes = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: linkableCustomerEmail, password: 'customer' },
      })
      const token = (await loginRes.json()).token

      const changeRes = await apiRequest('/auth/password', {
        method: 'PATCH',
        token,
        body: { currentPassword: 'customer', newPassword: 'freshpassword' },
      })
      expect(changeRes.status).toBe(200)

      const oldLoginRes = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: linkableCustomerEmail, password: 'customer' },
      })
      expect(oldLoginRes.status).toBe(401)

      const newLoginRes = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: linkableCustomerEmail, password: 'freshpassword' },
      })
      expect(newLoginRes.status).toBe(200)
    })
  })
})