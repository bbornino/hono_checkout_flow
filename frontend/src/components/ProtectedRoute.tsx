import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/stores/authStore'

type ProtectedRouteProps = {
    requiredRole?: string
}

function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
    const token = useAuthStore((state) => state.token)
    const role = useAuthStore((state) => state.role)

    if (!token) {
        return <Navigate to="/login" replace />
    }

    if (requiredRole && role !== requiredRole) {
        return <Navigate to="/" replace />
    }

    return <Outlet/>
}

export default ProtectedRoute