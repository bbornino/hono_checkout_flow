import { Routes, Route } from 'react-router'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Orders from './pages/Orders'

function App() {
  return (
    <div>
      <Navbar />

      <Routes>
        <Route path="/" element = {<Home />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/orders" element={<Orders />} />
        </Route>
      </Routes>
    </div>
  )
}

export default App