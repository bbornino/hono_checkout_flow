import { cors } from 'hono/cors'

export const corsMiddleware = cors({
origin: ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE']
})