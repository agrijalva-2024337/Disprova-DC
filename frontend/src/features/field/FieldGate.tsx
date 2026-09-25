import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../admin/auth/AuthContext.tsx'

export function FieldGate() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
