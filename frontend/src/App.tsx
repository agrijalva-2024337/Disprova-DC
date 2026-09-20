import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/admin/auth/LoginPage.tsx'
import { CategoriesPage } from './features/admin/categories/CategoriesPage.tsx'
import { AdminLayout } from './features/admin/layout/AdminLayout.tsx'
import { PriceListsPage } from './features/admin/price-lists/PriceListsPage.tsx'
import { ProductFormPage } from './features/admin/products/ProductFormPage.tsx'
import { ProductsPage } from './features/admin/products/ProductsPage.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="productos" replace />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="productos" element={<ProductsPage />} />
        <Route path="productos/nuevo" element={<ProductFormPage />} />
        <Route path="productos/:id" element={<ProductFormPage />} />
        <Route path="listas-precio" element={<PriceListsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
