import {pgTable, serial, varchar, text, integer, bigint, boolean, timestamp, real, doublePrecision, jsonb, check} from 'drizzle-orm/pg-core'
import {sql} from 'drizzle-orm'

export const customers = pgTable('customers', {
    id: serial('id').primaryKey(),
    firstName: varchar('first_name', {length: 50}).notNull(),
    lastName: varchar('last_name', {length:50}).notNull(),
    email: varchar('email', {length: 255}).notNull().unique(),
    phone: varchar('phone', {length: 20}),
    isGuest: boolean('is_guest').notNull().default(true),
    marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
})

export const addresses = pgTable('addresses', {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id').notNull().references(() => customers.id, {onDelete: 'cascade'}),
    label: varchar('label', {length: 50}),
    addressLine1: varchar('address_line1', {length: 255}).notNull(),
    addressLine2: varchar('address_line2', {length: 255}),
    city: varchar('city', {length: 100}).notNull(),
    state: varchar('state', {length: 50}).notNull(),
    postalCode: varchar('postal_code', {length: 20}).notNull(),
    country: varchar('country', {length: 2}).notNull(),
    isDefaultShipping: boolean('is_default_shipping').notNull().default(false),
    isDefaultBilling: boolean('is_default_billing').notNull().default(false),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
})

export const products = pgTable('products', {
    id: serial('id').primaryKey(),
    sku: varchar('sku', {length: 50}).notNull().unique(),
    name: varchar('name', {length: 200}).notNull(),
    priceCents: integer('price_cents').notNull(),
    weightOz: doublePrecision('weight_oz').notNull(),
    isActive: boolean('is_active').notNull().default(true),
})

export const discounts = pgTable('discounts', {
    id: serial('id').primaryKey(),
    code: varchar('code', {length: 50}).notNull().unique(),
    description: varchar('description', {length: 255}).notNull(),
    discountType: varchar('discount_type', {length: 20}).notNull(),
    percentageOff: real('percentage_off'),
    fixedCents: integer('fixed_cents'),
    maxUses: integer('max_uses'),
    timesUsed: integer('times_used').notNull().default(0),
    validFrom: timestamp('valid_from', {withTimezone: true}).notNull(),
    validUntil: timestamp('valid_until', {withTimezone: true}).notNull(),
    isActive: boolean('is_active').notNull().default(true),
})

export const orders = pgTable('orders', {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id').notNull().references(() => customers.id, {onDelete: 'restrict'}),
    shippingAddressId: integer('shipping_address_id').notNull().references(() => addresses.id, {onDelete: 'restrict'}),
    billingAddressId: integer('billing_address_id').notNull().references(() => addresses.id, {onDelete: 'restrict'}),
    discountId: integer('discount_id').references(() => discounts.id, {onDelete: 'restrict'}),
    status: varchar('status', {length: 20}).notNull(),
    subtotalCents: integer('subtotal_cents').notNull(),
    taxCents: integer('tax_cents').notNull(),
    shippingCents: integer('shipping_cents').notNull(),
    discountCents: integer('discount_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    taxRate: real('tax_rate').notNull(),
    currency: varchar('currency', {length: 3}).notNull(),
    externalOrderNumber: bigint('external_order_number', {mode: 'bigint'}),
    isGift: boolean('is_gift').notNull().default(false),
    giftMessage: text('gift_message'),
    shippingMetadata: jsonb('shipping_metadata').$type<Record<string, unknown>>(),
    placedAt: timestamp('placed_at', {withTimezone: true}).notNull(),
})

export const orderItems = pgTable('order_items', {
    id: serial('id').primaryKey(),
    orderId: integer('order_id').notNull().references(() => orders.id, {onDelete: 'cascade'}),
    productId: integer('product_id').notNull().references(() => products.id, {onDelete: 'restrict'}),
    quantity: integer('quantity').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    lineTotalCents: integer('line_total_cents').notNull(),
}, (table) => [
    check('quantity_positive', sql`${table.quantity} > 0`),
])

export const payments = pgTable('payments', {
    id: serial('id').primaryKey(),
    orderId: integer('order_id').notNull().references(() => orders.id, {onDelete:'cascade'}),
    amountCents: integer('amount_cents').notNull(),
    status: varchar('status', {length: 20}),
    method: varchar('method', {length: 30}),
    externalPaymentId: bigint('external_payment_id', {mode: 'bigint'}),
    processedAt: timestamp('processed_at', {withTimezone: true}),
    failureReason: text('failure_reason'),
    rawResponse: jsonb('raw_response').$type<Record<string,unknown>>(),
})

export const orderEvents = pgTable('order_events', {
    id: serial('id').primaryKey(),
    orderId: integer('order_id').notNull().references(() => orders.id, {onDelete: 'cascade'}),
    status: varchar('status', {length: 20}).notNull(),
    occurredAt: timestamp('occurred_at', {withTimezone: true}).notNull(),
    note: text('note'),
})

export const shipments = pgTable('shipments', {
    id: serial('id').primaryKey(),
    orderId: integer('order_id').notNull().references(() => orders.id, {onDelete: 'cascade'}),
    carrier: varchar('carrier', {length: 50}).notNull(),
    trackingNumber: varchar('tracking_number', {length: 100}).notNull(),
    shippedAt: timestamp('shipped_at', {withTimezone: true}),
    estimatedDeliveryAt: timestamp('estimated_delivery_at', {withTimezone: true}),
    deliveredAt: timestamp('delivered_at', {withTimezone: true}),
    carrierMetadata: jsonb('carrier_metadata').$type<Record<string,unknown>>(),
})