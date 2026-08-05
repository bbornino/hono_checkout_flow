import {Hono} from 'hono'
import {db} from '../db/index.js'
import {products, orders, orderItems, orderEvents, customers} from '../db/schema.js'
import {z as zod} from 'zod'
import {eq, inArray, and} from 'drizzle-orm'
import amqp from 'amqplib'
import {requireAuth} from '../middleware/auth.js'
import { validateDiscountCode } from '../discountValidation.js'
import { RABBITMQ_URL, ORDER_PLACED_QUEUE, ORDER_STATUSES, ALLOWED_TRANSITIONS, TAX_RATE, SHIPPING_CENTS, type OrderStatus } from '../constants.js'

// -------------    Router instance          -----------------
const ordersRouter = new Hono()


// -------------    Zod Schemas        -----------------
const orderCreateSchema = zod.object({
  customerId: zod.number().int().positive().optional(),
  shippingAddressId: zod.number().int().positive(),
  billingAddressId: zod.number().int().positive(),
  discountCode: zod.string().optional(),
  isGift: zod.boolean().default(false),
  giftMessage: zod.string().optional(),
  items: zod.array(
    zod.object({
      productId: zod.number().int().positive(),
      quantity: zod.number().int().positive(),
    })
  ).min(1),
})

const orderStatusUpdateSchema = zod.object({
  status: zod.enum(ORDER_STATUSES),
  note: zod.string().optional(),
})

// -------------    Types         -----------------
type OrderItemData = {
  productId: number
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
}

type OrderTotalsResult =
  | { success: true; data: {
      orderItemsData: OrderItemData[]
      subtotalCents: number
      taxCents: number
      shippingCents: number
      discountCents: number
      discountId: number | null
      totalCents: number
    } }
  | { success: false; error: string }


// -------------    Helper Functions         -----------------
async function calculateOrderTotals(
  items: { productId: number; quantity: number }[],
  discountCode?: string
): Promise<OrderTotalsResult> {
    const productIds = items.map((item) => item.productId)
    const foundProducts = await db.select().from(products).where(inArray(products.id, productIds))

    if (foundProducts.length !== productIds.length) {
        return { success: false, error: 'One or more productId values do not exist' }
    }

    const productMap = new Map(foundProducts.map((product) => [product.id, product]))

    const orderItemsData: OrderItemData[] = items.map((item) => {
    const product = productMap.get(item.productId)!
    const lineTotalCents = product.priceCents * item.quantity

    return {
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: product.priceCents,
        lineTotalCents,
    }
    })

    const subtotalCents = orderItemsData.reduce((sum, item) => sum + item.lineTotalCents, 0)
    const taxCents = Math.round(subtotalCents * TAX_RATE)
    const shippingCents = SHIPPING_CENTS

    let discountCents = 0
    let discountId: number | null = null

    if (discountCode) {
      const validation = await validateDiscountCode(discountCode)
      if (!validation.valid) {
        return {success: false, error: validation.error}
      }

      const discount = validation.discount
      discountId = discount.id

      if (discount.discountType === 'percentage') {
        discountCents = Math.round(subtotalCents * (discount.percentageOff! / 100))
      } else {
        discountCents = discount.fixedCents!
      }
    }

    const totalCents = subtotalCents - discountCents + taxCents + shippingCents

    return {
        success: true,
        data: { orderItemsData, subtotalCents, taxCents, shippingCents, discountCents, discountId, totalCents },
    }
}

async function publishOrderPlaced(orderId: number) {
  const connection = await amqp.connect(RABBITMQ_URL)
  const channel = await connection.createChannel()

  await channel.assertQueue(ORDER_PLACED_QUEUE, {durable: true})
  channel.sendToQueue(ORDER_PLACED_QUEUE, Buffer.from(JSON.stringify({orderId})))

  await channel.close()
  await connection.close()
}

// -------------    Routes         -----------------

ordersRouter.post('/', requireAuth, async (context) => {
    const user = context.get('user')
    const body = await context.req.json()
    const result = orderCreateSchema.safeParse(body)

    if (!result.success) {
        return context.json({ error:zod.flattenError(result.error)}, 400)
    }

    let effectiveCustomerId: number

    if (user.role === 'admin') {
      if (!result.data.customerId) {
        return context.json({error: 'customerId is required when placing an order as admin'}, 400)
      }
      effectiveCustomerId = result.data.customerId
    } else {
      const [customer] = await db.select().from(customers).where(eq(customers.userId, user.userId))

      if (!customer) {
        return context.json({ error: 'No customer record linked to this account'}, 404)
      } 

      effectiveCustomerId = customer.id
    } 

    const totals = await calculateOrderTotals(result.data.items, result.data.discountCode)

    if (!totals.success) {
        return context.json({error: totals.error}, 400)
    }

    const newOrder = await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values({
        customerId: effectiveCustomerId,
        shippingAddressId: result.data.shippingAddressId,
        billingAddressId: result.data.billingAddressId,
        discountId: totals.data.discountId,
        status: 'pending',
        subtotalCents: totals.data.subtotalCents,
        taxCents: totals.data.taxCents,
        shippingCents: totals.data.shippingCents,
        discountCents: totals.data.discountCents,
        totalCents: totals.data.totalCents,
        taxRate: TAX_RATE,
        currency: 'USD',
        isGift: result.data.isGift,
        giftMessage: result.data.giftMessage,
        placedAt: new Date(),
      }).returning()

      await tx.insert(orderItems).values(
        totals.data.orderItemsData.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          lineTotalCents: item.lineTotalCents,
        }))
      )

      await tx.insert(orderEvents).values({
        orderId: order.id,
        status: 'pending',
        occurredAt: new Date(),
      })

      return order
    })

    await publishOrderPlaced(newOrder.id)
    return context.json(newOrder, 201)
})

ordersRouter.get('/:orderId', requireAuth, async (context) => {
  const user = context.get('user')
  const orderId = Number(context.req.param('orderId'))
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))

  if (!order) {
    return context.json({error: `No order found for id ${orderId}`}, 404)
  } else if (user.role === 'customer') {
    const [customer] = await db.select().from(customers).where(eq(customers.userId, user.userId))
    if (!customer) {
      return context.json({ error: 'No customer record linked to this account'} , 404)
    } else if (customer.id !== order.customerId) {
      return context.json({ error: 'Access denied'}, 404)
    }
  }

  const items = await db.select({
    id: orderItems.id,
    productId: orderItems.productId,
    productName: products.name,
    quantity: orderItems.quantity,
    unitPriceCents: orderItems.unitPriceCents,
    lineTotalCents: orderItems.lineTotalCents,
  }).from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId))

  const events = await db.select({
    id: orderEvents.id,
    status: orderEvents.status,
    occurredAt: orderEvents.occurredAt,
    note: orderEvents.note,
  }).from(orderEvents).where(eq(orderEvents.orderId, orderId)).orderBy(orderEvents.occurredAt)

  return context.json({...order, items, events})
})

ordersRouter.get('/', requireAuth, async (context) => {
  const user = context.get('user')
  const customerId = context.req.query('customerId')
  const status = context.req.query('status')

  const conditions = []

  if (user.role === 'admin') {
    if (customerId) {
      conditions.push(eq(orders.customerId, Number(customerId)))
    }

    if (status) {
      conditions.push(eq(orders.status, status))
    }
  } else {
    const [customer] = await db.select().from(customers).where(eq(customers.userId, user.userId))

    if (!customer) {
      return context.json({ error: 'No customer record linked to this account'}, 404)
    }

    conditions.push(eq(orders.customerId, customer.id))

    if (status) {
      conditions.push(eq(orders.status, status))
    }
  }

  const allOrders = conditions.length > 0
    ? await db.select().from(orders).where(and(...conditions))
    : await db.select().from(orders)
  
  return context.json(allOrders)
})

ordersRouter.patch('/:orderId', requireAuth, async (context) => {
  const user = context.get('user')

  if (user.role !== 'admin') {
    return context.json({error: 'Admin access required'}, 403)
  }

  const orderId = Number(context.req.param('orderId'))
  const body = await context.req.json()
  const result = orderStatusUpdateSchema.safeParse(body)

  if (!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))

  if (!order) {
    return context.json({error: `No order found for id ${orderId}`}, 404)
  }

  const currentStatus = order.status as OrderStatus
  const allowedNext = ALLOWED_TRANSITIONS[currentStatus]

  if (!allowedNext.includes(result.data.status)) {
    return context.json({
      error: `Cannot transition from ${currentStatus} to ${result.data.status}. Allowed: ${allowedNext.join(', ') || 'none (terminal status)'}`,
    }, 409)
  }

  const updatedOrder = await db.transaction(async (tx) => {
    const [updated] = await tx.update(orders).set({status: result.data.status}).where(eq(orders.id, orderId)).returning()

    await tx.insert(orderEvents).values({
      orderId: orderId,
      status: result.data.status,
      occurredAt: new Date(),
      note: result.data.note,
    })

    return updated
  })

  return context.json(updatedOrder)
})

export { ordersRouter }