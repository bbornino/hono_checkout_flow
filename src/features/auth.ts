import {Hono} from 'hono'
import {eq} from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import {db} from '../db/index.js'
import {users, customers} from '../db/schema.js'
import {z as zod} from 'zod'
import bcrypt from 'bcrypt'
import { USER_ROLES, JWT_SECRET } from '../constants.js';

const authRouter = new Hono()
const signupSchema = zod.object({
    email: zod.email(),
    password: zod.string().min(2),      // Deliberately loose for solo-dev convenience — production would enforce length/complexity here
    role: zod.enum(USER_ROLES).default('customer'),
    firstName: zod.string().min(1).max(50).optional(),
    lastName: zod.string().min(1).max(50).optional(),
    phone: zod.e164().max(20).optional(),
    existingCustomerId: zod.number().int().positive().optional(),
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

    let newUser

    try {
        newUser = await db.transaction(async (tx) => {
            const [user] = await tx.insert(users).values({
                email: result.data.email,
                passwordHash,
                role: result.data.role,
            }).returning()

            if (result.data.role === 'customer') {
                if (result.data.existingCustomerId) {
                    // Guest converting an existing order history into a real account
                    const [existingCustomer] = await tx.select().from(customers).where(eq(customers.id, result.data.existingCustomerId))
                    if (!existingCustomer) {
                        throw new Error('existingCustomerId does not reference a real customer')
                    }

                    if (existingCustomer.email !== result.data.email) {
                        throw new Error('existingCustomerId does not belong to this email address')
                    }

                    if (existingCustomer.userId !== null) {
                        throw new Error('This customer record is already linked to an account')
                    }

                    await tx.update(customers).set({userId: user.id}).where(eq(customers.id, result.data.existingCustomerId))
                } else {
                    // brand new customer signing up directly - no prior order history
                    if (!result.data.firstName || !result.data.lastName) {
                        throw new Error('firstName and lastName are required for new customer signup')
                    }

                    await tx.insert(customers).values({
                        userId: user.id,
                        firstName: result.data.firstName,
                        lastName: result.data.lastName,
                        email: result.data.email,
                        phone: result.data.phone,
                        isGuest: false,
                    })
                }
            }

            return user
        })
    } catch (err) {
        const message = err instanceof Error ? err.message: 'Signup failed'
        return context.json({error: message}, 400)
    }

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