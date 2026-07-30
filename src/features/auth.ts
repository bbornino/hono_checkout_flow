import {Hono} from 'hono'
import {db} from '../db/index.js'
import {users} from '../db/schema.js'
import {z as zod} from 'zod'
import bcrypt from 'bcrypt'
import { USER_ROLES } from '../constants.js';

const authRouter = new Hono()
const signupSchema = zod.object({
    email: zod.email(),
    password: zod.string().min(2),      // Deliberately loose for solo-dev convenience — production would enforce length/complexity here
    role: zod.enum(USER_ROLES).default('customer'),
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

export {authRouter}