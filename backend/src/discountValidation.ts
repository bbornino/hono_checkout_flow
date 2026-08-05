import { db } from './db/index.js'
import { discounts } from './db/schema.js'
import { eq } from 'drizzle-orm'

type DiscountValidationResult = 
    | { valid: true; discount: typeof discounts.$inferSelect }
    | { valid: false; error: string }

export async function validateDiscountCode(code: string): Promise<DiscountValidationResult> {
    const [discount] = await db.select().from(discounts).where(eq(discounts.code, code))

    if (!discount) {
        return {valid: false, error: 'Invalid discount code'}
    }

    if (!discount.isActive) {
        return {valid: false, error: 'This discount is no longer active'}
    }

    const now = new Date()
    if (now < discount.validFrom || now > discount.validUntil) {
        return {valid: false, error: 'This discount is not currently valid'}
    }

    if (discount.maxUses !== null && discount.timesUsed >= discount.maxUses) {
        return {valid: false, error: 'This discount has reached its usage limit'}
    }

    return { valid: true, discount}
}