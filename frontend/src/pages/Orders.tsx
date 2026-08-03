import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

type Order = {
  id: number
  status: string
  totalCents: number
  placedAt: string
}

function Orders() {
  const { data, isLoading, error } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders').then((res) => res.data),
  })

  if (error) return <p className="text-red-600">Something went wrong.</p>

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">My Orders</h1>
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))
        ) : data?.length === 0 ? (
          <p className="text-gray-500">No orders yet.</p>
        ) : (
          data?.map((order) => (
            <Card key={order.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Order #{order.id}</CardTitle>
                <Badge>{order.status}</Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {new Date(order.placedAt).toLocaleDateString()}
                </p>
                <p className="font-semibold">${(order.totalCents / 100).toFixed(2)}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

export default Orders