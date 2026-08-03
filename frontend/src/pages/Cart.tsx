import { Link } from "react-router"
import { useCartStore } from "@/stores/cartStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

function Cart() {
    const { items, removeItem, updateQuantity, clearCart } = useCartStore()
    const subtotalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)

    if (items.length === 0) {
        return (
            <div>
                <h1 className="mb-4 text-2xl font-bold">Cart</h1>
                <p className="text=gray-500">Your cart is empty.</p>
                <Link to="/" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                    Browse Products
                </Link>
            </div>
        )
    }

    return (
        <div>
            <h1 className="mb-4 text-2xl font-bold">Cart</h1>

            <div className="space-y-3">
                {items.map((item) => (
                    <Card key={item.productId}>
                        <CardContent className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-gray-500">
                                    ${(item.priceCents / 100).toFixed(2)} each
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button size="sm" variant="outline"
                                    onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                                    >-</Button>
                                <span>{item.quantity}</span>
                                <Button size="sm" variant="outline"
                                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                    >+</Button>
                                
                                <p className="w-20 text-right font-semibold">
                                    ${((item.priceCents * item.quantity) / 100).toFixed(2)}
                                </p>

                                <Button size="sm" variant="ghost"
                                    onClick={() => removeItem(item.productId)}>Remove</Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="mt-6 flex items-center justify-between border-t pt-4">
                <Button variant="outline" onClick={clearCart}>Clear Cart</Button>
                <div className="text-right">
                    <p className="text-sm text-gray-500">Subtotal</p>
                    <p className="text-xl font-bold">${(subtotalCents / 100).toFixed(2)}</p>
                </div>
            </div>

            <div className="mt-4 justify-end">
                <Link to="/checkout">
                    <Button size="lg">Proceed to Checkout</Button>
                </Link>
            </div>
        </div>
    )
}

export default Cart
