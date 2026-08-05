import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type OrderItem = {
  id: number
  productId: number
  productName: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
}

type OrderEvent = {
  id: number
  status: string
  occuredAt: string
  note: string | null
}

type Order = {
  id: number
  status: string
  totalCents: number
  placedAt: string
}

type OrderDetail = Order & {
  items: OrderItem[]
  events: OrderEvent[]
}

const CANCELLABLE_STATUSES = ['pending', 'paid', 'fulling']

function Orders() {
  const queryClient = useQueryClient()
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const { data: orders, isLoading, error } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders').then((res) => res.data),
  })

  const { data: expandedOrder, isLoading: detailLoading } = useQuery<OrderDetail>({
    queryKey: ['order', expandedOrderId],
    queryFn: () => api.get(`/orders/${expandedOrderId}`).then((res) => res.data),
    enabled: expandedOrderId !== null,
  })

  function toggleExpand(orderId: number) {
    setExpandedOrderId((current) => (current === orderId ? null : orderId))
  }

  async function handleCancel(orderId: number) {
    setCancellingId(orderId)
    try {
      await api.patch(`/orders/${orderId}`, { status: 'cancelled' })
      queryClient.invalidateQueries({ queryKey: ['orders']})
      queryClient.invalidateQueries({ queryKey: ['order', orderId]})
    } finally {
      setCancellingId(null)
    }
  }

  if (error) return <p className="text-red-600">Something went wrong.</p>

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">My Orders</h1>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : orders?.length === 0 ? (
        <p className="text-gray-500">No orders yet.</p>
      ) : (
        <div className='space-y-3'>
          {orders?.map((order) => {
            const isExpanded = expandedOrderId === order.id
            const canCancel = CANCELLABLE_STATUSES.includes(order.status)

            return (
            <Card key={order.id}>
              <CardHeader className="flex cursor-pointer flex-row items-center justify-between"
                  onClick={() => toggleExpand(order.id)}>
                <div className='flex items-center gap-3'>
                  <CardTitle>Order #{order.id}</CardTitle>
                  <Badge>{order.status}</Badge>
                </div>
                <div className='flex items-center gap-4'>
                  <span className='text-sm text-gray-500'>
                    {new Date(order.placedAt).toLocaleDateString()}
                  </span>
                  <span className='font-semibold'>${(order.totalCents / 100).toFixed(2)}</span>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className='border-t pt-4'>
                  {detailLoading ? (
                    <p className='text-sm text-gray-500'>Loading details...</p>
                  ) : (
                    <>
                      <div className='space-y-1'>
                        {expandedOrder?.items.map((item) => (
                          <div key={item.id} className='flex justify-between text-sm'>
                            <span>{item.productName} x {item.quantity}</span>
                            <span>${(item.lineTotalCents / 100).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      {canCancel && (
                        <Button variant="outline" size="sm" className='mt-4'
                            disabled={cancellingId === order.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCancel(order.id)
                            }}>
                          {cancellingId === order.id ? 'Cancelling...' : 'Cancel Order'}
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })}
        </div>
      )}
    </div>
  )
}

export default Orders