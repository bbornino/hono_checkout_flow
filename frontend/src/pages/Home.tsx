import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

type Product = {
  id: number
  sku: string
  name: string
  priceCents: number
  weightOz: number
  isActive: boolean
}

function Home() {
  const { data, isLoading, error } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/products`).then((res) => res.json()),
  })


  if (error) return <p>Something went wrong.</p>


  return (
    <div>
        <h1 className="mb-4 text-2xl font-bold">Products</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-lg" />
                ))
                : data?.map((product) => (
                    <Card key={product.id}>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                {product.name}
                                <Badge variant={product.isActive ? 'default' : 'secondary'}>
                                    {product.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-lg font-semibold">
                                ${(product.priceCents / 100).toFixed(2)}
                            </p>
                            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                        </CardContent>
                    </Card>
                ))
            }
        </div>
    </div>
  )
}

export default Home