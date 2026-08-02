import { Link } from 'react-router'

function Navbar() {
    return (
        <nav className="border-b bg-wite px-6 py-4">
            <div className="flex items-center gap-6">
                <Link to="/" className="text-lg font-bold">Hono Checkout Flow</Link>
                <Link to="/" className="text-sm text-gray-600 hover:text-black">Products</Link>
                <Link to="/login" className="text-sm text-gray-600 hover:text-black">Login</Link>
            </div>
        </nav>
    )
}

export default Navbar