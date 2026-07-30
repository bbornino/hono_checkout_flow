import {Hono} from 'hono'
import {db} from '../db/index.js'
import {shipments} from '../db/schema.js'
import {z as zod} from 'zod'
import {eq} from 'drizzle-orm'
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

shipmentsRouter.get('/', async (context) => {
  const allShipments = await db.select().from(shipments)
  return context.json(allShipments)
})

shipmentsRouter.post('/', async (context) => {
  const body = await context.req.json()
  const result = shipmentSchema.safeParse(body)

  if(!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  try {
    const [newShipment] = await db.insert(shipments).values(result.data).returning()
    return context.json(newShipment, 201)
  } catch (err) {
    return context.json({error: 'orderId does not reference an existing order'}, 400)
  }
  
  
})

shipmentsRouter.get('/:shipmentId', async(context) => {
  const shipmentId = Number(context.req.param('shipmentId'))
  const [shipment] = await db.select().from(shipments).where(eq(shipments.id, shipmentId))

  if (!shipment) {
    return context.json({error: `No shipment found for id ${shipmentId}`}, 404)
  }

  return context.json(shipment)
})

shipmentsRouter.patch('/:shipmentId', async(context) => {
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
