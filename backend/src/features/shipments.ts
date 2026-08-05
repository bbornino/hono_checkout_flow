import {Hono} from 'hono'
import {db} from '../db/index.js'
import {shipments, orders, customers} from '../db/schema.js'
import {z as zod} from 'zod'
import {eq} from 'drizzle-orm'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const shipmentsRouter = new Hono()

const shipmentBaseSchema = zod.object({
    orderId: zod.number().int().positive(),
    carrier: zod.string().max(50),
    trackingNumber: zod.string().max(100),
    estimatedDeliveryAt: zod.coerce.date().optional(),
    carrierMetadata: zod.record(zod.string(), zod.unknown()).optional(),
})

const shipmentSchema = shipmentBaseSchema

const shipmentUpdateSchema = zod.object({
    shippedAt: zod.coerce.date(),
    estimatedDeliveryAt: zod.coerce.date(),
    deliveredAt: zod.coerce.date(),
    carrierMetadata: zod.record(zod.string(), zod.unknown()),
}).partial()

async function resolveOwnCustomerId(userId: number): Promise<number | null> {
  const [customer] = await db.select().from(customers).where(eq(customers.userId, userId))
  return customer ? customer.id : null
}

shipmentsRouter.get('/', requireAuth, requireAdmin, async (context) => {
  const allShipments = await db.select().from(shipments)
  return context.json(allShipments)
})

shipmentsRouter.post('/', requireAuth, async (context) => {
  const user = context.get('user')
  const body = await context.req.json()
  const result = shipmentSchema.safeParse(body)

  if(!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, result.data.orderId))
  if (!order) {
    return context.json({error: 'orderId does not ference an existing order'}, 400)
  }

  if (user.role !== 'admin') {
    const myCustomerId = await resolveOwnCustomerId(user.userId)
    if (!myCustomerId || order.customerId !== myCustomerId) {
      return context.json({error: 'orderId does not reference an existing order'}, 400)
    }
  }

  try {
    const [newShipment] = await db.insert(shipments).values(result.data).returning()
    return context.json(newShipment, 201)
  } catch (err) {
    return context.json({error: 'orderId does not reference an existing order'}, 400)
  }
  
  
})

shipmentsRouter.get('/:shipmentId', requireAuth, async(context) => {
  const user = context.get('user')
  const shipmentId = Number(context.req.param('shipmentId'))
  const [shipment] = await db.select().from(shipments).where(eq(shipments.id, shipmentId))

  if (!shipment) {
    return context.json({error: `No shipment found for id ${shipmentId}`}, 404)
  }

  if (user.role !== 'admin') {
    const [order] = await db.select().from(orders).where(eq(orders.id, shipment.orderId))
    const myCustomerId = await resolveOwnCustomerId(user.userId)
    if (!order || !myCustomerId  || order.customerId !== myCustomerId) {
      return context.json({error: `No shipment found for id ${shipmentId}`}, 404)
    }
  }

  return context.json(shipment)
})

shipmentsRouter.patch('/:shipmentId', requireAuth, requireAdmin, async(context) => {
  const shipmentId = Number(context.req.param('shipmentId'))
  const body = await context.req.json()
  const result = shipmentUpdateSchema.safeParse(body)
  
  if (!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  if (Object.keys(result.data).length === 0) {
    return context.json({error: 'No fields provided to update'}, 400)
  }

  const [updatedShipment] = await db.update(shipments).set(result.data).where(eq(shipments.id, shipmentId)).returning()

  if (!updatedShipment) {
    return context.json({error: `No shipment found for id ${shipmentId}`}, 404)
  }

  return context.json(updatedShipment)
})


export { shipmentsRouter }
