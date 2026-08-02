import { Routes, Route, Link } from 'react-router'
import Home from './pages/Home'
import Login from './pages/Login'


function App() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link> | <Link to="/login">Login</Link>
      </nav>

      <Routes>
        <Route path="/" element = {<Home />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </div>
  )
}

export default App