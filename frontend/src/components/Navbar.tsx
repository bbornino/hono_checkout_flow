import { Link, useNavigate } from 'react-router'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { Button } from '@/components/ui/button'

function Navbar() {
    const navigate = useNavigate()
    const token = useAuthStore((state) => state.token)
    const logout = useAuthStore((state) => state.logout)
    const cartCount = useCartStore((state) =>
        state.items.reduce((sum, item) => sum + item.quantity, 0)
    )

    function handleLogout() {
        logout()
        navigate('login')
    }
    return (
        <nav className="border-b bg-wite px-6 py-4">
            <div className='flex items-center justify-between'>
                <div className="flex items-center gap-6">
                    <Link to="/" className="text-lg font-bold">Hono Checkout Flow</Link>
                    <Link to="/" className="text-sm text-gray-600 hover:text-black">Products</Link>
                    <Link to="/cart" className='text-sm text-gray-600 hover:text-black'>
                        Cart {cartCount > 0 && `(${cartCount})`}
                    </Link>

                    {token ? (
                        <div>
                            <Link to="/orders" className='text-sm text-gray-600 hover:text-black'>Orders</Link>
                            <Button variant="outline" onClick={handleLogout}>Log Out</Button>
                        </div>
                        
                    ) : (
                        <Link to="/login" className="text-sm text-gray-600 hover:text-black">Login</Link>
                    )}
                </div>
            </div>
        </nav>
    )
}

export default Navbar