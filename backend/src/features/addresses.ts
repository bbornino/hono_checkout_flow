import {Hono} from 'hono'
import {db} from '../db/index.js'
import {addresses, customers} from '../db/schema.js'
import {z as zod} from 'zod'
import {eq} from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
const addressRouter = new Hono()

const addressBaseSchema = zod.object({
    customerId: zod.number().int().positive(),
    label: zod.string().min(3).max(50).optional(),
    addressLine1: zod.string().max(255),
    addressLine2: zod.string().max(255).optional(),
    city: zod.string().min(3).max(100),
    state: zod.string().min(2).max(50),
    postalCode: zod.string().min(5).max(20),
    country: zod.string().length(2).regex(/^[A-Z]{2}$/, 'Must be a 2-letter ISO country code').toUpperCase(), 
    isDefaultShipping: zod.boolean(),
    isDefaultBilling: zod.boolean(),
})

const addressSchema = addressBaseSchema.extend({
    isDefaultShipping: zod.boolean().default(false),
    isDefaultBilling: zod.boolean().default(false),
})

const addressUpdateSchema = addressBaseSchema.omit({customerId: true}).partial()

addressRouter.get('/', requireAuth, async (context) => {
  const user = context.get('user')

  if (user.role === 'admin') {
    const allAddresses = await db.select().from(addresses)
    return context.json(allAddresses)
  }

  const [customer] = await db.select().from(customers).where(eq(customers.userId, user.userId))

  if (!customer) {
    return context.json({ error: 'No customer record linked to this account' }, 404)
  }

  const myAddresses = await db.select().from(addresses).where(eq(addresses.customerId, customer.id))
  return context.json(myAddresses)

})

addressRouter.post('/', requireAuth, async (context) => {
  const user = context.get('user')
  const body = await context.req.json()
  
  let effectiveCustomerId: number

  if (user.role === 'admin') {
    if (!body.customerId) {
      return context.json({ error: 'customerId is required when creating an address as admin'}, 400)
    }
    effectiveCustomerId = body.customerId
  } else {
    const [customer] = await db.select().from(customers).where(eq(customers.userId, user.userId))

    if (!customer) {
      return context.json({error: 'No custome record linked to this account' }, 404)
    }

    effectiveCustomerId = customer.id
  }
  
  const result = addressSchema.safeParse({ ...body, customerId: effectiveCustomerId})

  if(!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  try {
    const [newAddress] = await db.insert(addresses).values(result.data).returning()
    return context.json(newAddress, 201)
  } catch (err) {
    return context.json({error: 'customerId does not reference an existing customer'}, 400)
  }
  
  
})

addressRouter.get('/:addressId', requireAuth, async(context) => {
  const user = context.get('user')
  const addressId = Number(context.req.param('addressId'))
  const [address] = await db.select().from(addresses).where(eq(addresses.id, addressId))

  if (!address) {
    return context.json({error: `No address found for id ${addressId}`}, 404)
  }

  if (user.role !== 'admin') {
    const [customer] = await db.select().from(customers).where(eq(customers.userId, user.userId))
    if (!customer || address.customerId !== customer.id) {
      return context.json({ error: `No address found for id ${addressId}` }, 404)
    }
  }
  return context.json(address)
})

addressRouter.patch('/:addressId', requireAuth, async(context) => {
  const user = context.get('user')
  const addressId = Number(context.req.param('addressId'))
  const body = await context.req.json()
  const result = addressUpdateSchema.safeParse(body)
  
  if (!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  if (Object.keys(result.data).length === 0) {
    return context.json({error: 'No fields provided to update'}, 400)
  }

  const [existingAddress] = await db.select().from(addresses).where(eq(addresses.id, addressId))

  if (!existingAddress) {
    return context.json({error: `No address found for id ${addressId}`}, 404)
  }

  if (user.role !== 'admin') {
    const [customer] = await db.select().from(customers).where(eq(customers.userId, user.userId))
    if (!customer || existingAddress.customerId !== customer.id) {
      return context.json({error: `No address found for id ${addressId}`}, 404)
    }
  }

  const [updatedAddress] = await db.update(addresses).set(result.data).where(eq(addresses.id, addressId)).returning()
  return context.json(updatedAddress)
})

addressRouter.delete('/:addressId', requireAuth, async(context) => {
  const user = context.get('user')
  const addressId = Number(context.req.param('addressId'))

  const [existingAddress] = await db.select().from(addresses).where(eq(addresses.id, addressId))
  if (!existingAddress) {
    return context.json({ error: `No address found for id ${addressId}`}, 404)
  }

  if (user.role !== 'admin') {
    const [customer] = await db.select().from(customers).where(eq(customers.userId, user.userId))
    if (!customer || existingAddress.customerId !== customer.id) {
      return context.json({ error: `No address found for id ${addressId}`}, 404)
    }
  }

  try {
    const [deletedAddress] = await db.delete(addresses).where(eq(addresses.id, addressId)).returning()
    return context.json(deletedAddress)
  } catch (err) {
    return context.json({error: 'Cannot delete address with existing orders'}, 409)
  }
})


export { addressRouter }
