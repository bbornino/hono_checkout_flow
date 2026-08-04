import {Hono} from 'hono'
import {db} from '../db/index.js'
import {customers, users} from '../db/schema.js'
import {z as zod} from 'zod'
import {eq} from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
const customersRouter = new Hono()

const customerBaseSchema = zod.object({
    firstName: zod.string().min(3).max(50),
    lastName: zod.string().min(3).max(50),
    email: zod.email().max(255),
    phone: zod.e164().max(20).optional(),
    isGuest: zod.boolean(),
    marketingOptIn: zod.boolean(),
})

const customerSchema = customerBaseSchema.extend({
    isGuest: zod.boolean().default(true),
    marketingOptIn: zod.boolean().default(false),
})

const customerUpdateSchema = customerBaseSchema.partial()

customersRouter.get('/', requireAuth, async (context) => {
  const user = context.get('user')

  if (user.role !== 'admin') {
    return context.json({error: 'Admin access required'}, 403)
  }
  const allCustomers = await db.select().from(customers)
  return context.json(allCustomers)
})

customersRouter.post('/', async (context) => {
  const body = await context.req.json()
  const result = customerSchema.safeParse(body)

  if(!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  const [newCustomer] = await db.insert(customers).values(result.data).returning()
  return context.json(newCustomer, 201)
})

customersRouter.get('/me', requireAuth, async (context) => {
  const user = context.get('user')

  const [customer] = await db.select().from(customers).where(eq(customers.userId, user.userId))

  if (!customer) {
    return context.json({ error: 'No customer linked to this account'}, 404)
  }

  return context.json(customer)
})

customersRouter.get('/:customerId', requireAuth, async(context) => {
  const user = context.get('user')
  const customerId = Number(context.req.param('customerId'))
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId))

  if (!customer) {
    return context.json({error: `No customer found for id ${customerId}`}, 404)
  }

  if (user.role !== 'admin' && customer.userId !== user.userId) {
    return context.json({error: `No customer found for id ${customerId}`}, 404)
  }

  return context.json(customer)
})

customersRouter.patch('/:customerId', requireAuth, async(context) => {
  const user = context.get('user')
  const customerId = Number(context.req.param('customerId'))
  const body = await context.req.json()
  
  const result = customerUpdateSchema.safeParse(body)
  if (!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  if (Object.keys(result.data).length === 0) {
    return context.json({error: 'No fields provided to update'}, 400)
  }

  const [existingCustomer] = await db.select().from(customers).where(eq(customers.id, customerId))
  if (!existingCustomer) {
    return context.json({error: `No customer found for id ${customerId}`}, 404)
  }

  if (user.role !== 'admin' && existingCustomer.userId !== user.userId) {
    return context.json({error: `No customer found for id ${customerId}`}, 404)
  }

  try {
    const updatedCustomer = await db.transaction(async (tx) => {
      const [updated] = await db.update(customers).set(result.data).where(eq(customers.id, customerId)).returning()

      if (result.data.email && existingCustomer.userId) {
        await tx.update(users).set({ email: result.data.email }).where(eq(users.id, existingCustomer.userId))
      }

      return updated
    })
    return context.json(updatedCustomer)

  } catch (err) {
    return context.json({ error: 'That email is alrady in use' }, 409)
  }
})

customersRouter.delete('/:customerId', requireAuth, async(context) => {
  const user = context.get('user')
  const customerId = Number(context.req.param('customerId'))

  const [existingCustomer] = await db.select().from(customers).where(eq(customers.id, customerId))
  if (!existingCustomer) {
    return context.json({error:`No customer found for id ${customerId}`}, 404)
  }

  if (user.role !== 'admin' && existingCustomer.userId !== user.userId) {
    return context.json({error: `No customer found for id ${customerId}`}, 404)
  }

  try {
    const [deletedCustomer] = await db.delete(customers).where(eq(customers.id, customerId)).returning()

    return context.json(deletedCustomer)
  } catch (err) {
    return context.json({error: 'Cannot delete customer with existing orders'}, 409)
  }
})


export { customersRouter }
