import 'dotenv/config'
import { db } from './index.js'
import { users, customers, addresses, products, discounts } from './schema.js'
import { sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function seed() {
  console.log('Wiping existing data...')
  await db.execute(sql`
    TRUNCATE order_events, order_items, payments, shipments, orders,
    addresses, customers, users, discounts, products
    RESTART IDENTITY CASCADE
  `)

  console.log('Creating products...')
  await db.insert(products).values([
    { sku: 'MUG-001', name: 'Ceramic Coffee Mug', priceCents: 1299, weightOz: 12, isActive: true },
    { sku: 'TSHIRT-001', name: 'Cotton T-Shirt', priceCents: 2499, weightOz: 6, isActive: true },
    { sku: 'NOTEBOOK-001', name: 'Ruled Notebook', priceCents: 899, weightOz: 8, isActive: true },
    { sku: 'WATERBOTTLE-001', name: 'Steel Water Bottle', priceCents: 1999, weightOz: 14, isActive: true },
    { sku: 'BACKPACK-001', name: 'Canvas Backpack', priceCents: 5999, weightOz: 32, isActive: true },
    { sku: 'HEADPHONES-001', name: 'Wireless Headphones', priceCents: 8999, weightOz: 10, isActive: true },
    { sku: 'CANDLE-001', name: 'Soy Wax Candle', priceCents: 1599, weightOz: 9, isActive: false },
  ])

  console.log('Creating discounts...')
  await db.insert(discounts).values([
    {
      code: 'WELCOME10',
      description: '10% off your first order',
      discountType: 'percentage',
      percentageOff: 10,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      isActive: true,
    },
    {
      code: 'SAVE5',
      description: '$5 off any order',
      discountType: 'fixed',
      fixedCents: 500,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      isActive: true,
    },
    {
      code: 'EXPIRED',
      description: 'An expired code, for testing rejection',
      discountType: 'fixed',
      fixedCents: 1000,
      validFrom: new Date('2025-01-01'),
      validUntil: new Date('2025-12-31'),
      isActive: true,
    },
  ])

  console.log('Creating admin account...')
  await db.insert(users).values({
    email: 'admin@hono.test',
    passwordHash: await bcrypt.hash('admin', 10),
    role: 'admin',
  })

  console.log('Creating customer account...')
  const [customerUser] = await db.insert(users).values({
    email: 'customer@hono.test',
    passwordHash: await bcrypt.hash('customer', 10),
    role: 'customer',
  }).returning()

  const [customer] = await db.insert(customers).values({
    userId: customerUser.id,
    firstName: 'Customer',
    lastName: 'Smith',
    email: 'customer@hono.test',
    phone: '+15551234567',
    isGuest: false,
    marketingOptIn: true,
  }).returning()

  console.log('Creating addresses...')
  await db.insert(addresses).values([
    {
      customerId: customer.id,
      label: 'Home',
      addressLine1: '123 Maple Street',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
      country: 'US',
      isDefaultShipping: true,
      isDefaultBilling: true,
    },
    {
      customerId: customer.id,
      label: 'Work',
      addressLine1: '500 Corporate Blvd',
      addressLine2: 'Suite 200',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      country: 'US',
      isDefaultShipping: false,
      isDefaultBilling: false,
    },
  ])

  console.log('Seed complete.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})