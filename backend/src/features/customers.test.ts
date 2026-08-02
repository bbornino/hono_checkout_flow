import 'dotenv/config'
import { describe, it, expect, afterAll } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL!

describe('Customers API', () => {
  let testCustomerId: number

  describe('POST /customers', () => {
    it('creates a customer with valid data', async () => {
      const response = await fetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Test',
          lastName: 'User',
          email: `test-${Date.now()}@example.com`,
        }),
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.firstName).toBe('Test')
      expect(body.isGuest).toBe(true)
      testCustomerId = body.id
    })

    it('rejects a customer with an invalid email', async () => {
      const response = await fetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Test',
          lastName: 'User',
          email: 'not-an-email',
        }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe('GET /customers', () => {
    it('returns an array of customers', async () => {
      const response = await fetch(`${BASE_URL}/customers`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(Array.isArray(body)).toBe(true)
    })
  })

  describe('GET /customers/:customerId', () => {
    it('returns the matching customer', async () => {
      const response = await fetch(`${BASE_URL}/customers/${testCustomerId}`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe(testCustomerId)
    })

    it('returns 404 for a nonexistent customer', async () => {
      const response = await fetch(`${BASE_URL}/customers/9999999`)
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /customers/:customerId', () => {
    it('updates a single field', async () => {
      const response = await fetch(`${BASE_URL}/customers/${testCustomerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastName: 'Updated' }),
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.lastName).toBe('Updated')
      expect(body.firstName).toBe('Test')
    })

    it('rejects an empty body', async () => {
      const response = await fetch(`${BASE_URL}/customers/${testCustomerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
    })

    it('rejects invalid data', async () => {
      const response = await fetch(`${BASE_URL}/customers/${testCustomerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /customers/:customerId', () => {
    it('returns 404 for a nonexistent customer', async () => {
      const response = await fetch(`${BASE_URL}/customers/9999999`, {
        method: 'DELETE',
      })

      expect(response.status).toBe(404)
    })

    it('deletes the test customer', async () => {
      const response = await fetch(`${BASE_URL}/customers/${testCustomerId}`, {
        method: 'DELETE',
      })

      expect(response.status).toBe(200)
    })
  })
})