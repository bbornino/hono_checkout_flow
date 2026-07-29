import {Hono} from 'hono'
import {db} from '../db/index.js'
import {products} from '../db/schema.js'
import {z as zod} from 'zod'
import {eq} from 'drizzle-orm'

const productsRouter = new Hono()

const productBaseSchema = zod.object({
    sku: zod.string().max(50),
    name: zod.string().max(200),
    priceCents: zod.number().int().positive(),
    weightOz: zod.number().positive(),
    isActive: zod.boolean(),
})

const productSchema = productBaseSchema.extend({
    isActive: zod.boolean().default(true),
})

const productUpdateSchema = productBaseSchema.partial()

productsRouter.get('/', async (context) => {
  const allProducts = await db.select().from(products)
  return context.json(allProducts)
})

productsRouter.post('/', async (context) => {
  const body = await context.req.json()
  const result = productSchema.safeParse(body)

  if(!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  try {
    const [newProduct] = await db.insert(products).values(result.data).returning()
    return context.json(newProduct, 201)
  } catch (err) {
    return context.json({error: 'A product with this SKU already exists'}, 409)
  }
  
  
})

productsRouter.get('/:productId', async(context) => {
  const productId = Number(context.req.param('productId'))
  const [product] = await db.select().from(products).where(eq(products.id, productId))

  if (!product) {
    return context.json({error: `No product found for id ${productId}`}, 404)
  }

  return context.json(product)
})

productsRouter.patch('/:productId', async(context) => {
  const productId = Number(context.req.param('productId'))
  const body = await context.req.json()
  const result = productUpdateSchema.safeParse(body)
  
  if (!result.success) {
    return context.json({error: zod.flattenError(result.error)}, 400)
  }

  if (Object.keys(result.data).length === 0) {
    return context.json({error: 'No fields provided to update'}, 400)
  }

  try {
    const [updatedProduct] = await db.update(products).set(result.data).where(eq(products.id, productId)).returning()

    if (!updatedProduct) {
      return context.json({error: `No product found for id ${productId}`}, 404)
    }

    return context.json(updatedProduct)

  } catch (err) {
    return context.json({error: 'A product with this SKU already exists'}, 409)
  }
})

productsRouter.delete('/:productId', async(context) => {
  const productId = Number(context.req.param('productId'))

  try {
    const [deletedProduct] = await db.delete(products).where(eq(products.id, productId)).returning()

    if (!deletedProduct) {
      return context.json({error:`No product found for id ${productId}`}, 404)
    }

    return context.json(deletedProduct)
  } catch (err) {
    return context.json({error: 'Cannot delete product with existing orders'}, 409)
  }
})


export { productsRouter }
