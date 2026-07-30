import {Hono} from 'hono'
import {db} from '../db/index.js'
import {payments} from '../db/schema.js'
import {z as zod} from 'zod'
import {eq} from 'drizzle-orm'
import { PAYMENT_STATUSES } from '../constants.js'

const paymentsRouter = new Hono()

const paymentBaseSchema = zod.object({
    orderId: zod.number().int().positive(),
    amountCents: zod.number().int().positive(),
    method: zod.string().max(30).optional(),
    externalPaymentId: zod.bigint().optional(),
})

const paymentSchema = paymentBaseSchema.extend({
    status: zod.enum(PAYMENT_STATUSES).default('pending'),
})

const paymentUpdateSchema = zod.object({
    status: zod.enum(PAYMENT_STATUSES),
    failureReason: zod.string().max(255).optional(),
    processedAt: zod.coerce.date().optional(),
    rawResponse: zod.record(zod.string(), zod.unknown()).optional(),
}).partial()

paymentsRouter.get('/', async (context) => {
  const allPayments = await db.select().from(payments)
  return context.json(allPayments)
})

paymentsRouter.post('/', async (context) => {
  const body = await context.req.json()
  const result = paymentSchema.safeParse(body)

  if(!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  try {
    const [newPayment] = await db.insert(payments).values(result.data).returning()
    return context.json(newPayment, 201)
  } catch (err) {
    return context.json({error: 'orderId does not reference an existing order'}, 400)
  }
})

paymentsRouter.get('/:paymentId', async(context) => {
  const paymentId = Number(context.req.param('paymentId'))
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId))

  if (!payment) {
    return context.json({error: `No payment found for id ${paymentId}`}, 404)
  }

  return context.json(payment)
})

paymentsRouter.patch('/:paymentId', async(context) => {
  const paymentId = Number(context.req.param('paymentId'))
  const body = await context.req.json()
  const result = paymentUpdateSchema.safeParse(body)
  
  if (!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  if (Object.keys(result.data).length === 0) {
    return context.json({error: 'No fields provided to update'}, 400)
  }

  const [updatedPayment] = await db.update(payments).set(result.data).where(eq(payments.id, paymentId)).returning()

  if (!updatedPayment) {
    return context.json({error: `No payment found for id ${paymentId}`}, 404)
  }

  return context.json(updatedPayment)
})


export { paymentsRouter }
