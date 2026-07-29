import {Hono} from 'hono'
import {db} from '../db/index.js'
import {customers} from '../db/schema.js'
import {z as zod} from 'zod'
import {eq} from 'drizzle-orm'
const customersRouter = new Hono()

const customerSchema = zod.object({
    firstName: zod.string().min(3).max(50),
    lastName: zod.string().min(3).max(50),
    email: zod.email().max(255),
    phone: zod.e164().max(20).optional(),
    isGuest: zod.boolean().default(true),
    marketingOptIn: zod.boolean().default(false),
})

const customerUpdateSchema = customerSchema.partial()

customersRouter.get('/', async (context) => {
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

customersRouter.get('/:customerId', async(context) => {
  const customerId = Number(context.req.param('customerId'))
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId))

  if (!customer) {
    return context.json({error: `No customer found for id ${customerId}`}, 404)
  }

  return context.json(customer)
})

customersRouter.patch('/:customerId', async(context) => {
  const customerId = Number(context.req.param('customerId'))
  const body = await context.req.json()
  const result = customerUpdateSchema.safeParse(body)
  
  if (!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  if (Object.keys(result.data).length === 0) {
    return context.json({error: 'No fields provided to update'}, 400)
  }

  const [updatedCustomer] = await db.update(customers).set(result.data).where(eq(customers.id, customerId)).returning()

  if (!updatedCustomer) {
    return context.json({error: `No customer found for id ${customerId}`}, 404)
  }

  return context.json(updatedCustomer)
})

customersRouter.delete('/:customerId', async(context) => {
  const customerId = Number(context.req.param('customerId'))

  try {
    const [deletedCustomer] = await db.delete(customers).where(eq(customers.id, customerId)).returning()

    if (!deletedCustomer) {
      return context.json({error:`No customer found for id ${customerId}`}, 404)
    }

    return context.json(deletedCustomer)
  } catch (err) {
    return context.json({error: 'Cannot delete customer with existing orders'}, 409)
  }
})


export { customersRouter }
