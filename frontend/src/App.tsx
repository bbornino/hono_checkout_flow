import { Routes, Route } from 'react-router'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Orders from './pages/Orders'
import Cart from './pages/Cart'
import Signup from './pages/Signup'

function App() {
  return (
    <div>
      <Navbar />

      <Routes>
        <Route path="/" element = {<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup /> } />
        <Route path="/cart" element={<Cart />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/orders" element={<Orders />} />
        </Route>
      </Routes>
    </div>
  )
}

export default App