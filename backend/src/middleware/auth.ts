// src/middleware/auth.ts
import jwt from 'jsonwebtoken'
import { createMiddleware } from 'hono/factory'
import { JWT_SECRET } from '../constants.js'

type JwtPayload = {
    userId: number
    role: string
}

export const requireAuth = createMiddleware<{
    Variables: {user: JwtPayload }
}>(async (context, next) => {
    const authHeader = context.req.header('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return context.json({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')

    try {
        const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
        context.set('user', payload)
        await next()
    } catch {
        return context.json({error: 'Invalid or expired token'}, 401)
    }
})

export const requireAdmin = createMiddleware<{
    Variables: { user: JwtPayload }
}>(async (context, next) => {
    const user = context.get('user')
    if (user.role !== 'admin') {
        return context.json({error: 'Admin access required'}, 403)
    }
    await next()
})
