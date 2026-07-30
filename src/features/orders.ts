import {Hono} from 'hono'
import {db} from '../db/index.js'
import {products, discounts} from '../db/schema.js'
import {z as zod} from 'zod'
import {eq, inArray} from 'drizzle-orm'

// -------------    Router instance          -----------------
const ordersRouter = new Hono()


// -------------    Constants          -----------------
const TAX_RATE = 0.08
const SHIPPING_CENTS = 599


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

    return context.json(totals.data)
})






export { ordersRouter }