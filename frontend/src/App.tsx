import { Routes, Route } from 'react-router'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Orders from './pages/Orders'
import Cart from './pages/Cart'
import Signup from './pages/Signup'
import Addresses from './pages/Addresses'
import Account from './pages/Account'
import Checkout from './pages/Checkout'

function App() {
  return (
    <div>
      <Navbar />

      <main className='p-6'>
        <Routes>
          <Route path="/" element = {<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup /> } />
          <Route path="/cart" element={<Cart />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/orders" element={<Orders />} />
            <Route path="/addresses" element={<Addresses />} />
            <Route path="/account" element={<Account />} />
            <Route path='/checkout' element={<Checkout />} />
          </Route>
        </Routes>
      </main>
    </div>
  )
}

export default App