import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/admin/auth/LoginPage.tsx'
import { CategoriesPage } from './features/admin/categories/CategoriesPage.tsx'
import { AdminLayout } from './features/admin/layout/AdminLayout.tsx'
import { PriceListsPage } from './features/admin/price-lists/PriceListsPage.tsx'
import { ProductFormPage } from './features/admin/products/ProductFormPage.tsx'
import { ProductsPage } from './features/admin/products/ProductsPage.tsx'
import { ClientFormPage } from './features/admin/clients/ClientFormPage.tsx'
import { ClientsPage } from './features/admin/clients/ClientsPage.tsx'
import { KardexPage } from './features/admin/inventory/KardexPage.tsx'
import { InventoryPage } from './features/admin/inventory/InventoryPage.tsx'
import { ZonesPage } from './features/admin/zones/ZonesPage.tsx'
import { FieldGate } from './features/field/FieldGate.tsx'
import { OrderPlaceholderPage } from './features/field/OrderPlaceholderPage.tsx'
import { TodayRoutePage } from './features/field/TodayRoutePage.tsx'

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
        <Route path="inventario" element={<InventoryPage />} />
        <Route path="inventario/:productId" element={<KardexPage />} />
        <Route path="zonas" element={<ZonesPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="clientes/nuevo" element={<ClientFormPage />} />
        <Route path="clientes/:id" element={<ClientFormPage />} />
      </Route>
      <Route path="/ruta" element={<FieldGate />}>
        <Route index element={<TodayRoutePage />} />
        <Route path="pedido/:clientId" element={<OrderPlaceholderPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
