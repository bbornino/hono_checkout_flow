import { describe, it, expect, beforeAll } from 'vitest'
import { apiRequest, createTestUser } from '../testHelpers.js'

function validDiscountBody(overrides = {}) {
  return {
    code: `TEST-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: 'Test discount',
    discountType: 'percentage',
    percentageOff: 10,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: '2026-12-31T00:00:00.000Z',
    ...overrides,
  }
}

describe('Discounts API', () => {
  let testDiscountId: number
  let adminToken: string
  let customerToken: string

  beforeAll(async () => {
    adminToken = await createTestUser('admin')
    customerToken = await createTestUser('customer')
  })

  describe('Auth protection', () => {
    it('rejects GET /discounts with no token', async () => {
      const response = await apiRequest('/discounts')
      expect(response.status).toBe(401)
    })

    it('rejects a customer role from listing discounts', async () => {
      const response = await apiRequest('/discounts', { token: customerToken })
      expect(response.status).toBe(403)
    })

    it('rejects a customer role from creating a discount', async () => {
      const response = await apiRequest('/discounts', {
        method: 'POST',
        token: customerToken,
        body: validDiscountBody(),
      })
      expect(response.status).toBe(403)
    })
  })

  describe('POST /discounts', () => {
    it('creates a percentage discount with valid data', async () => {
      const response = await apiRequest('/discounts', {
        method: 'POST',
        token: adminToken,
        body: validDiscountBody(),
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.discountType).toBe('percentage')
      expect(body.isActive).toBe(true)
      testDiscountId = body.id
    })

    it('creates a fixed-cents discount with valid data', async () => {
      const response = await apiRequest('/discounts', {
        method: 'POST',
        token: adminToken,
        body: validDiscountBody({
          discountType: 'fixed',
          percentageOff: undefined,
          fixedCents: 500,
        }),
      })

      expect(response.status).toBe(201)
    })

    it('rejects an invalid discountType', async () => {
      const response = await apiRequest('/discounts', {
        method: 'POST',
        token: adminToken,
        body: validDiscountBody({ discountType: 'buy-one-get-one' }),
      })

      expect(response.status).toBe(400)
    })

    it('rejects a percentage discount missing percentageOff', async () => {
      const response = await apiRequest('/discounts', {
        method: 'POST',
        token: adminToken,
        body: validDiscountBody({ percentageOff: undefined }),
      })

      expect(response.status).toBe(400)
    })

    it('rejects validUntil before validFrom', async () => {
      const response = await apiRequest('/discounts', {
        method: 'POST',
        token: adminToken,
        body: validDiscountBody({
          validFrom: '2026-12-31T00:00:00.000Z',
          validUntil: '2026-01-01T00:00:00.000Z',
        }),
      })

      expect(response.status).toBe(400)
    })

    it('rejects a duplicate code', async () => {
      const duplicateCode = `DUPLICATE-${Date.now()}`

      await apiRequest('/discounts', {
        method: 'POST',
        token: adminToken,
        body: validDiscountBody({ code: duplicateCode }),
      })

      const response = await apiRequest('/discounts', {
        method: 'POST',
        token: adminToken,
        body: validDiscountBody({ code: duplicateCode }),
      })

      expect(response.status).toBe(409)
    })
  })

  describe('GET /discounts/:discountId', () => {
    it('allows admin to view a discount', async () => {
      const response = await apiRequest(`/discounts/${testDiscountId}`, { token: adminToken })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe(testDiscountId)
    })

    it('rejects a customer from viewing a discount', async () => {
      const response = await apiRequest(`/discounts/${testDiscountId}`, { token: customerToken })
      expect(response.status).toBe(403)
    })

    it('returns 404 for a nonexistent discount', async () => {
      const response = await apiRequest('/discounts/9999999', { token: adminToken })
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /discounts/:discountId', () => {
    it('updates a single field', async () => {
      const response = await apiRequest(`/discounts/${testDiscountId}`, {
        method: 'PATCH',
        token: adminToken,
        body: { description: 'Updated description' },
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.description).toBe('Updated description')
    })

    it('rejects a customer from updating a discount', async () => {
      const response = await apiRequest(`/discounts/${testDiscountId}`, {
        method: 'PATCH',
        token: customerToken,
        body: { description: 'Hijacked' },
      })

      expect(response.status).toBe(403)
    })

    it('rejects an empty body', async () => {
      const response = await apiRequest(`/discounts/${testDiscountId}`, {
        method: 'PATCH',
        token: adminToken,
        body: {},
      })

      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /discounts/:discountId', () => {
    it('rejects a customer from deleting a discount', async () => {
      const response = await apiRequest(`/discounts/${testDiscountId}`, {
        method: 'DELETE',
        token: customerToken,
      })
      expect(response.status).toBe(403)
    })

    it('returns 404 for a nonexistent discount', async () => {
      const response = await apiRequest('/discounts/9999999', {
        method: 'DELETE',
        token: adminToken,
      })
      expect(response.status).toBe(404)
    })

    it('deletes the test discount', async () => {
      const response = await apiRequest(`/discounts/${testDiscountId}`, {
        method: 'DELETE',
        token: adminToken,
      })
      expect(response.status).toBe(200)
    })
  })
})