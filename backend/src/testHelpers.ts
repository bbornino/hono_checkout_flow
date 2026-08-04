import { BASE_URL } from "./constants.js"

type ApiRequestOptions = {
    method?: string
    body?: unknown
    token?: string
}

export async function apiRequest(path: string, options: ApiRequestOptions = {}) {
    const headers: Record<string, string> = {}

    if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json'
    }

    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`
    }

    return fetch(`${BASE_URL}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
}

export async function createTestUser(
    role: 'customer' | 'admin', 
    existingCustomerId?: number,
    existingCustomerEmail?: string
) {
    const email = existingCustomerEmail ?? `test-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
    const password = role

    await apiRequest('/auth/signup', {
        method: 'POST',
        body: { email, password, role, existingCustomerId,
            firstName: existingCustomerId ? undefined : 'Test',
            lastName: existingCustomerId ? undefined : 'User',
        },
    })

    const loginRes = await apiRequest('/auth/login', { method: 'POST', body: {email, password} })
    const { token } = await loginRes.json()
    return token as string
}