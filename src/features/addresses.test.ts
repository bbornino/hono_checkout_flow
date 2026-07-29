import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const BASE_URL = process.env.TEST_BASE_URL!

describe('Addresses API', () => {
    let testCustomerId: number
    let testAddressId: number

    beforeAll(async () => {
        const response = await fetch(`${BASE_URL}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            firstName: 'Address',
            lastName: 'Tester',
            email: `address-test-${Date.now()}@example.com`,
            }),
        })
        const customer = await response.json()
        testCustomerId = customer.id
    })

    afterAll(async () => {
        await fetch(`${BASE_URL}/customers/${testCustomerId}`, { method: 'DELETE' })
    })

    describe('POST /addresses', () => {
        it('creates an address with valid data', async () => {
            const response = await fetch(`${BASE_URL}/addresses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: testCustomerId,
                    addressLine1: '555 Main Street',
                    city: 'San Francisco',
                    state: 'CA',
                    postalCode: '95111',
                    country: 'US',
                }),
            })
    
            expect(response.status).toBe(201)
            const body = await response.json()
            expect(body.state).toBe('CA')
            expect(body.isDefaultShipping).toBe(false)
            testAddressId = body.id
        })
    
        it('rejects an address with an invalid country', async () => {
            const response = await fetch(`${BASE_URL}/addresses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    addressLine1: '555 Main Street',
                    city: 'San Francisco',
                    state: 'CA',
                    postalCode: '95111',
                    country: 'USA',
                }),
            })
    
            expect(response.status).toBe(400)
        })

        // inside describe('POST /addresses', ...)
        it('rejects a customerId that does not exist', async () => {
            const response = await fetch(`${BASE_URL}/addresses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                customerId: 9999999,
                addressLine1: '123 Main St',
                city: 'Springfield',
                state: 'IL',
                postalCode: '62704',
                country: 'US',
                }),
            })

            expect(response.status).toBe(400)
        })
    })
  
    describe('GET /addresses', () => {
      it('returns an array of addresses', async () => {
        const response = await fetch(`${BASE_URL}/addresses`)
        expect(response.status).toBe(200)
        const body = await response.json()
        expect(Array.isArray(body)).toBe(true)
      })
    })
  
    describe('GET /addresses/:addressId', () => {
      it('returns the matching address', async () => {
        const response = await fetch(`${BASE_URL}/addresses/${testAddressId}`)
        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.id).toBe(testAddressId)
      })
  
      it('returns 404 for a nonexistent address', async () => {
        const response = await fetch(`${BASE_URL}/addresses/9999999`)
        expect(response.status).toBe(404)
      })
    })
  
    describe('PATCH /addresses/:addressId', () => {
        it('updates a single field', async () => {
            const response = await fetch(`${BASE_URL}/addresses/${testAddressId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addressLine1: 'Updated' }),
            })
    
            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.addressLine1).toBe('Updated')
            expect(body.state).toBe('CA')
        })
  
        it('rejects an empty body', async () => {
            const response = await fetch(`${BASE_URL}/addresses/${testAddressId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })
    
            expect(response.status).toBe(400)
        })
  
        it('rejects invalid data', async () => {
            const response = await fetch(`${BASE_URL}/addresses/${testAddressId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country: 'USA' }),
            })
    
            expect(response.status).toBe(400)
        })

        it('rejects an attempt to change customerId', async () => {
            const response = await fetch(`${BASE_URL}/addresses/${testAddressId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: 99999 }),
            })

            expect(response.status).toBe(400)
        })
    })
  
    describe('DELETE /addresses/:addressId', () => {
        it('returns 404 for a nonexistent address', async () => {
            const response = await fetch(`${BASE_URL}/addresses/9999999`, {
                method: 'DELETE',
            })
    
            expect(response.status).toBe(404)
        })
  
        it('deletes the test address', async () => {
            const response = await fetch(`${BASE_URL}/addresses/${testAddressId}`, {
                method: 'DELETE',
            })
    
            expect(response.status).toBe(200)
        })
    })
})