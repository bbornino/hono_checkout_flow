import {Hono} from 'hono'
import {eq} from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import {db} from '../db/index.js'
import {users} from '../db/schema.js'
import {z as zod} from 'zod'
import bcrypt from 'bcrypt'
import { USER_ROLES, JWT_SECRET } from '../constants.js';

const authRouter = new Hono()
const signupSchema = zod.object({
    email: zod.email(),
    password: zod.string().min(2),      // Deliberately loose for solo-dev convenience — production would enforce length/complexity here
    role: zod.enum(USER_ROLES).default('customer'),
})

const loginSchema = zod.object({
    email: zod.email(),
    password: zod.string(),
})

authRouter.post('/signup', async (context) => {
    const body = await context.req.json()
    const result = signupSchema.safeParse(body)

    if (!result.success) {
        return context.json({error: zod.flattenError(result.error)}, 400)
    }

    const passwordHash = await bcrypt.hash(result.data.password, 10)

    const [newUser] = await db.insert(users).values({
        email: result.data.email,
        passwordHash,
        role: result.data.role,
    }).returning()

    const { passwordHash: _, ...userWithoutHash } = newUser

    return context.json(userWithoutHash, 201)
})

authRouter.post('/login', async (context) => {
    const body = await context.req.json()
    const result = loginSchema.safeParse(body)

    if (!result.success) {
        return context.json({error: zod.flattenError(result.error)}, 400)
    }

    const [user] = await db.select().from(users).where(eq(users.email, result.data.email))
    if (!user) {
        return context.json({ error: 'Invalid email or password'}, 401)
    }

    const passwordMatches = await bcrypt.compare(result.data.password, user.passwordHash)
    if (!passwordMatches) {
        return context.json({ error: 'Invalid email or password' }, 401)
    }

    const token: string = jwt.sign(
        { userId: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    )

    return context.json({token})
})

export {authRouter}