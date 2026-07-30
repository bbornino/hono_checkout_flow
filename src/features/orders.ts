import {Hono} from 'hono'
import {db} from '../db/index.js'
import {products, discounts, orders, orderItems, orderEvents} from '../db/schema.js'
import {z as zod} from 'zod'
import {eq, inArray, and} from 'drizzle-orm'
import { ORDER_STATUSES, ALLOWED_TRANSITIONS, TAX_RATE, SHIPPING_CENTS, type OrderStatus } from '../constants.js'

// -------------    Router instance          -----------------
const ordersRouter = new Hono()


// -------------    Zod Schemas        -----------------
const orderCreateSchema = zod.object({
  customerId: zod.number().int().positive(),
  shippingAddressId: zod.number().int().positive(),
  billingAddressId: zod.number().int().positive(),
  discountId: zod.number().int().positive().optional(),
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
      totalCents: number
    } }
  | { success: false; error: string }


// -------------    Helper Functions         -----------------
async function calculateOrderTotals(
  items: { productId: number; quantity: number }[],
  discountId?: number
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

    if (discountId) {
        const [discount] = await db.select().from(discounts).where(eq(discounts.id, discountId))

        if (!discount) {
        return { success: false, error: 'discountId does not reference an existing discount' }
        }

        if (!discount.isActive) {
        return { success: false, error: 'This discount is no longer active' }
        }

        const now = new Date()
        if (now < discount.validFrom || now > discount.validUntil) {
        return { success: false, error: 'This discount is not currently valid' }
        }

        if (discount.maxUses !== null && discount.timesUsed >= discount.maxUses) {
        return { success: false, error: 'This discount has reached its usage limit' }
        }

        if (discount.discountType === 'percentage') {
        discountCents = Math.round(subtotalCents * (discount.percentageOff! / 100))
        } else {
        discountCents = discount.fixedCents!
        }
    }

    const totalCents = subtotalCents - discountCents + taxCents + shippingCents

    return {
        success: true,
        data: { orderItemsData, subtotalCents, taxCents, shippingCents, discountCents, totalCents },
    }
}


// -------------    Routes         -----------------

ordersRouter.post('/', async (context) => {
    const body = await context.req.json()
    const result = orderCreateSchema.safeParse(body)

    if (!result.success) {
        return context.json({ error:zod.flattenError(result.error)}, 400)
    }

    const totals = await calculateOrderTotals(result.data.items, result.data.discountId)

    if (!totals.success) {
        return context.json({error: totals.error}, 400)
    }

    const newOrder = await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values({
        customerId: result.data.customerId,
        shippingAddressId: result.data.shippingAddressId,
        billingAddressId: result.data.billingAddressId,
        discountId: result.data.discountId,
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

    return context.json(newOrder, 201)
})

ordersRouter.get('/:orderId', async (context) => {
  const orderId = Number(context.req.param('orderId'))
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))

  if (!order) {
    return context.json({error: `No order found for id ${orderId}`}, 404)
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

    return context.json({...order, items})
})

ordersRouter.get('/', async (context) => {
  const customerId = context.req.query('customerId')
  const status = context.req.query('status')

  const conditions = []

  if (customerId) {
    conditions.push(eq(orders.customerId, Number(customerId)))
  }

  if (status) {
    conditions.push(eq(orders.status, status))
  }

  const allOrders = conditions.length > 0
    ? await db.select().from(orders).where(and(...conditions))
    : await db.select().from(orders)
  
  return context.json(allOrders)
})

ordersRouter.patch('/:orderId', async (context) => {
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