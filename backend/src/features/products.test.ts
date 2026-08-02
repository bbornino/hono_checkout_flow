import 'dotenv/config'
import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL!

describe('Products API', () => {
  let testProductId: number

  describe('POST /products', () => {
    it('creates a product with valid data', async () => {
      const response = await fetch(`${BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: `TEST-${Date.now()}`,
          name: 'Testable Product 001',
          priceCents: 50,
          weightOz: 2.25,
        }),
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.name).toBe('Testable Product 001')
      expect(body.isActive).toBe(true)
      testProductId = body.id
    })

    it('rejects a product with a SKU over 50 characters', async () => {
      const response = await fetch(`${BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: 'X'.repeat(51),
          name: 'Testable Product 001',
          priceCents: 50,
          weightOz: 2.25,
        }),
      })

      expect(response.status).toBe(400)
    })

    it('rejects a duplicate SKU', async () => {
      const duplicateSku = `DUPLICATE-${Date.now()}`

      await fetch(`${BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: duplicateSku,
          name: 'First Product',
          priceCents: 50,
          weightOz: 2.25,
        }),
      })

      const response = await fetch(`${BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: duplicateSku,
          name: 'Second Product',
          priceCents: 75,
          weightOz: 1.5,
        }),
      })

      expect(response.status).toBe(409)
    })
  })

  describe('GET /products', () => {
    it('returns an array of products', async () => {
      const response = await fetch(`${BASE_URL}/products`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(Array.isArray(body)).toBe(true)
    })
  })

  describe('GET /products/:productId', () => {
    it('returns the matching product', async () => {
      const response = await fetch(`${BASE_URL}/products/${testProductId}`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.id).toBe(testProductId)
    })

    it('returns 404 for a nonexistent product', async () => {
      const response = await fetch(`${BASE_URL}/products/9999999`)
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /products/:productId', () => {
    it('updates a single field', async () => {
      const response = await fetch(`${BASE_URL}/products/${testProductId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: `UPDATED-${Date.now()}` }),
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.name).toBe('Testable Product 001')
    })

    it('rejects an empty body', async () => {
      const response = await fetch(`${BASE_URL}/products/${testProductId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
    })

    it('rejects a non-integer priceCents', async () => {
      const response = await fetch(`${BASE_URL}/products/${testProductId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceCents: 1.99 }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /products/:productId', () => {
    it('returns 404 for a nonexistent product', async () => {
      const response = await fetch(`${BASE_URL}/products/9999999`, {
        method: 'DELETE',
      })

      expect(response.status).toBe(404)
    })

    it('deletes the test product', async () => {
      const response = await fetch(`${BASE_URL}/products/${testProductId}`, {
        method: 'DELETE',
      })

      expect(response.status).toBe(200)
    })
  })
})