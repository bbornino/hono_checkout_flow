import {Hono} from 'hono'
import {db} from '../db/index.js'
import {discounts} from '../db/schema.js'
import {z as zod} from 'zod'
import {eq} from 'drizzle-orm'

const discountsRouter = new Hono()

const discountBaseSchema = zod.object({
    code: zod.string().max(50),
    description: zod.string().max(255),
    discountType: zod.enum(['percentage', 'fixed']),
    percentageOff: zod.number().positive().optional(),
    fixedCents: zod.number().int().positive().optional(),
    maxUses: zod.number().int().positive().optional(),
    validFrom: zod.coerce.date(),
    validUntil: zod.coerce.date(),
    isActive: zod.boolean(),
})

const discountSchema = discountBaseSchema.extend({
    isActive: zod.boolean().default(true),
}).refine(
  (data) => data.validUntil > data.validFrom,
  {
    message: 'validUntil must be after validFrom',
    path: ['validUntil'],
  }
).refine(
  (data) => data.discountType !== 'percentage' || data.percentageOff !== undefined,
  {
    message: 'percentageOff is required when discountType is percentage',
    path: ['percentageOff'],
  }
).refine(
  (data) => data.discountType !== 'fixed' || data.fixedCents !== undefined,
  {
    message: 'fixedCents is required when discountType is fixed',
    path: ['fixedCents'],
  }
)

const discountUpdateSchema = discountBaseSchema.partial().refine(
    (data) => {
        if(data.validFrom && data.validUntil) {
            return data.validUntil > data.validFrom
        }
        return true
    },
    {
        message: 'validUntil must be after validFrom',
        path: ['validUntil']
    }
).refine(
  (data) => {
    if (data.discountType === 'percentage') {
      return data.percentageOff !== undefined
    }
    return true
  },
  {
    message: 'percentageOff is required when discountType is percentage',
    path: ['percentageOff'],
  }
).refine(
  (data) => {
    if (data.discountType === 'fixed') {
      return data.fixedCents !== undefined
    }
    return true
  },
  {
    message: 'fixedCents is required when discountType is fixed',
    path: ['fixedCents'],
  }
)

discountsRouter.get('/', async (context) => {
  const allDiscounts = await db.select().from(discounts)
  return context.json(allDiscounts)
})

discountsRouter.post('/', async (context) => {
  const body = await context.req.json()
  const result = discountSchema.safeParse(body)

  if(!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  try {
    const [newDiscount] = await db.insert(discounts).values(result.data).returning()
    return context.json(newDiscount, 201)
  } catch (err) {
    return context.json({error: 'A discount with this code already exists'}, 409)
  }
})

discountsRouter.get('/:discountId', async(context) => {
  const discountId = Number(context.req.param('discountId'))
  const [discount] = await db.select().from(discounts).where(eq(discounts.id, discountId))

  if (!discount) {
    return context.json({error: `No discount found for id ${discountId}`}, 404)
  }

  return context.json(discount)
})

discountsRouter.patch('/:discountId', async(context) => {
  const discountId = Number(context.req.param('discountId'))
  const body = await context.req.json()
  const result = discountUpdateSchema.safeParse(body)
  
  if (!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  if (Object.keys(result.data).length === 0) {
    return context.json({error: 'No fields provided to update'}, 400)
  }

  try {
    const [updatedDiscount] = await db.update(discounts).set(result.data).where(eq(discounts.id, discountId)).returning()

    if (!updatedDiscount) {
      return context.json({error: `No discount found for id ${discountId}`}, 404)
    }

    return context.json(updatedDiscount)

  } catch (err) {
    return context.json({error: 'A discount with this code already exists'}, 409)
  }
})

discountsRouter.delete('/:discountId', async(context) => {
  const discountId = Number(context.req.param('discountId'))

  try {
    const [deletedDiscount] = await db.delete(discounts).where(eq(discounts.id, discountId)).returning()

    if (!deletedDiscount) {
      return context.json({error:`No discount found for id ${discountId}`}, 404)
    }

    return context.json(deletedDiscount)
  } catch (err) {
    return context.json({error: 'Cannot delete discount with existing orders'}, 409)
  }
})


export { discountsRouter }
