// src/constants.ts
import 'dotenv/config'
export const BASE_URL = process.env.TEST_BASE_URL!
export const RABBITMQ_URL = process.env.RABBITMQ_URL!

export const ORDER_STATUSES = ['pending', 'paid', 'fulfilling', 'shipped', 'delivered', 'cancelled', 'refunded'] as const
export type OrderStatus = typeof ORDER_STATUSES[number]

export const PAYMENT_STATUSES = ['pending', 'succeeded', 'failed', 'refunded'] as const

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['fulfilling', 'cancelled', 'refunded'],
  fulfilling: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
}

export const TAX_RATE = 0.08
export const SHIPPING_CENTS = 599