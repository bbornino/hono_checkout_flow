import {Hono} from 'hono'
import {eq} from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import { requireAuth } from '../middleware/auth.js'
import {db} from '../db/index.js'
import {users, customers} from '../db/schema.js'
import {flattenError, z as zod} from 'zod'
import bcrypt from 'bcryptjs'
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

const changePasswordSchema = zod.object({
    currentPassword: zod.string(),
    newPassword: zod.string().min(2),
})

authRouter.patch('/password', requireAuth, async (context) => {
    const user = context.get('user')
    const body = await context.req.json()
    const result = changePasswordSchema.safeParse(body)

    if (!result.success) {
        return context.json({error: flattenError(result.error) }, 400)
    }

    const [existingUser] = await db.select().from(users).where(eq(users.id, user.userId))
    if (!existingUser) {
        return context.json({error: 'User not found'}, 404)
    }

    const currentPasswordMatches = await bcrypt.compare(result.data.currentPassword, existingUser.passwordHash)
    if (!currentPasswordMatches) {
        return context.json({ error: 'Current password is incorrect'}, 401)
    }

    const newPasswordHash = await bcrypt.hash(result.data.newPassword, 10)
    try {
        const [updatedUser] = await db
            .update(users)
            .set({ passwordHash: newPasswordHash })
            .where(eq(users.id, user.userId))
            .returning()

        if (!updatedUser) {
            return context.json({ error: 'User not found' }, 404)
        }

        return context.json({ message: 'Password updated successfully' })
    } catch (err) {
        return context.json({ error: 'Failed to update password' }, 500)
    }
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