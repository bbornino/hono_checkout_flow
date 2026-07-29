import 'dotenv/config'
import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL!

function validDiscountBody(overrides = {}) {
  return {
    code: `TEST-${Date.now()}`,
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

  describe('POST /discounts', () => {
    it('creates a percentage discount with valid data', async () => {
      const response = await fetch(`${BASE_URL}/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validDiscountBody()),
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.discountType).toBe('percentage')
      expect(body.isActive).toBe(true)
      testDiscountId = body.id
    })

    it('creates a fixed-cents discount with valid data', async () => {
      const response = await fetch(`${BASE_URL}/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validDiscountBody({
          code: `FIXED-${Date.now()}`,
          discountType: 'fixed',
          percentageOff: undefined,
          fixedCents: 500,
        })),
      })

      expect(response.status).toBe(201)
    })

    it('rejects an invalid discountType', async () => {
      const response = await fetch(`${BASE_URL}/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validDiscountBody({ discountType: 'buy-one-get-one' })),
      })

      expect(response.status).toBe(400)
    })

    it('rejects a percentage discount missing percentageOff', async () => {
      const response = await fetch(`${BASE_URL}/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validDiscountBody({ percentageOff: undefined })),
      })

      expect(response.status).toBe(400)
    })

    it('rejects a fixed discount missing fixedCents', async () => {
      const response = await fetch(`${BASE_URL}/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validDiscountBody({
          discountType: 'fixed',
          percentageOff: undefined,
        })),
      })

      expect(response.status).toBe(400)
    })

    it('rejects validUntil before validFrom', async () => {
      const response = await fetch(`${BASE_URL}/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validDiscountBody({
          validFrom: '2026-12-31T00:00:00.000Z',
          validUntil: '2026-01-01T00:00:00.000Z',
        })),
      })

      expect(response.status).toBe(400)
    })

    it('rejects a duplicate code', async () => {
      const duplicateCode = `DUPLICATE-${Date.now()}`

      await fetch(`${BASE_URL}/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validDiscountBody({ code: duplicateCode })),
      })

      const response = await fetch(`${BASE_URL}/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validDiscountBody({ code: duplicateCode })),
      })

      expect(response.status).toBe(409)
    })
  })

  describe('GET /discounts', () => {
    it('returns an array of discounts', async () => {
      const response = await fetch(`${BASE_URL}/discounts`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(Array.isArray(body)).toBe(true)
    })
  })

  describe('GET /discounts/:discountId', () => {
    it('returns the matching discount', async () => {
      const response = await fetch(`${BASE_URL}/discounts/${testDiscountId}`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe(testDiscountId)
    })

    it('returns 404 for a nonexistent discount', async () => {
      const response = await fetch(`${BASE_URL}/discounts/9999999`)
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /discounts/:discountId', () => {
    it('updates a single field', async () => {
      const response = await fetch(`${BASE_URL}/discounts/${testDiscountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Updated description' }),
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.description).toBe('Updated description')
    })

    it('rejects an empty body', async () => {
      const response = await fetch(`${BASE_URL}/discounts/${testDiscountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
    })

    it('rejects an invalid discountType', async () => {
      const response = await fetch(`${BASE_URL}/discounts/${testDiscountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountType: 'buy-one-get-one' }),
      })

      expect(response.status).toBe(400)
    })

    it('rejects validUntil before validFrom when both are sent', async () => {
      const response = await fetch(`${BASE_URL}/discounts/${testDiscountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validFrom: '2026-12-31T00:00:00.000Z',
          validUntil: '2026-01-01T00:00:00.000Z',
        }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /discounts/:discountId', () => {
    it('returns 404 for a nonexistent discount', async () => {
      const response = await fetch(`${BASE_URL}/discounts/9999999`, {
        method: 'DELETE',
      })

      expect(response.status).toBe(404)
    })

    it('deletes the test discount', async () => {
      const response = await fetch(`${BASE_URL}/discounts/${testDiscountId}`, {
        method: 'DELETE',
      })

      expect(response.status).toBe(200)
    })
  })
})