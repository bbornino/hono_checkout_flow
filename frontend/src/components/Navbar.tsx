import { Link, useNavigate } from 'react-router'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu'

function Navbar() {
    const navigate = useNavigate()
    const token = useAuthStore((state) => state.token)
    const email = useAuthStore((state) => state.email)
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
                </div>

                <div>
                    {token ? (
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">{email}</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <Link to="/account">My Account</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link to="/orders">Orders</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link to="/addresses">My Addresses</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout}>Log Out</DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <div className="flex items-center gap-4">
                        <Link to="/login" className="text-sm text-gray-600 hover:text-black">Login</Link>
                        <Link to="/signup" className="text-sm text-gray-600 hover:text-black">Sign Up</Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    )
}

export default Navbar