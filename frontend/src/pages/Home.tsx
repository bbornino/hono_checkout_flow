import { useQuery } from '@tanstack/react-query'

function Home() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['products'],
        queryFn: () => fetch(`${import.meta.env.VITE_API_URL}/products`).then((res) => res.json()),
    })

    if (isLoading) return <p>Loading products...</p>
    if (error) return <p>Something went wrong.</p>

    return (
        <div>
            <h1>Products</h1>
            <ul>
                {data.map((product: any) => (
                    <li key={product.id}>
                        {product.name} - ${(product.priceCents / 100).toFixed(2)}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default Home