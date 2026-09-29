import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/admin/auth/LoginPage.tsx'
import { CategoriesPage } from './features/admin/categories/CategoriesPage.tsx'
import { AdminLayout } from './features/admin/layout/AdminLayout.tsx'
import { PriceListsPage } from './features/admin/price-lists/PriceListsPage.tsx'
import { ProductFormPage } from './features/admin/products/ProductFormPage.tsx'
import { ProductsPage } from './features/admin/products/ProductsPage.tsx'
import { ClientFormPage } from './features/admin/clients/ClientFormPage.tsx'
import { ClientsPage } from './features/admin/clients/ClientsPage.tsx'
import { OrderDetailPage } from './features/admin/orders/OrderDetailPage.tsx'
import { OrdersPage } from './features/admin/orders/OrdersPage.tsx'
import { NewReturnPage } from './features/admin/returns/NewReturnPage.tsx'
import { ReturnDetailPage } from './features/admin/returns/ReturnDetailPage.tsx'
import { CashSessionsListPage } from './features/admin/cash/CashSessionsListPage.tsx'
import { CashSessionPage } from './features/field/cash/CashSessionPage.tsx'
import { AccountStatementPage } from './features/admin/collections/AccountStatementPage.tsx'
import { AgingPage } from './features/admin/collections/AgingPage.tsx'
import { KardexPage } from './features/admin/inventory/KardexPage.tsx'
import { InventoryPage } from './features/admin/inventory/InventoryPage.tsx'
import { UsersPage } from './features/admin/users/UsersPage.tsx'
import { InvoicesPage } from './features/admin/billing/InvoicesPage.tsx'
import { BroadcastPage } from './features/admin/messaging/BroadcastPage.tsx'
import { TemplatesPage } from './features/admin/messaging/TemplatesPage.tsx'
import { DashboardPage } from './features/admin/reports/DashboardPage.tsx'
import { ZonesPage } from './features/admin/zones/ZonesPage.tsx'
import { FieldGate } from './features/field/FieldGate.tsx'
import { CartProvider } from './features/store/cart/CartContext.tsx'
import { CatalogPage } from './features/store/catalog/CatalogPage.tsx'
import { CheckoutPage } from './features/store/checkout/CheckoutPage.tsx'
import { OrderConfirmationPage } from './features/store/checkout/OrderConfirmationPage.tsx'
import { DeliveriesPage } from './features/field/DeliveriesPage.tsx'
import { DeliveryPage } from './features/field/DeliveryPage.tsx'
import { NewOrderPage } from './features/field/NewOrderPage.tsx'
import { CollectPage } from './features/field/CollectPage.tsx'
import { TodayRoutePage } from './features/field/TodayRoutePage.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="productos" element={<ProductsPage />} />
        <Route path="productos/nuevo" element={<ProductFormPage />} />
        <Route path="productos/:id" element={<ProductFormPage />} />
        <Route path="listas-precio" element={<PriceListsPage />} />
        <Route path="inventario" element={<InventoryPage />} />
        <Route path="inventario/:productId" element={<KardexPage />} />
        <Route path="zonas" element={<ZonesPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="pedidos/:id" element={<OrderDetailPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="clientes/nuevo" element={<ClientFormPage />} />
        <Route path="clientes/:id" element={<ClientFormPage />} />
        <Route path="usuarios" element={<UsersPage />} />
        <Route path="facturacion" element={<InvoicesPage />} />
        <Route path="mensajeria/plantillas" element={<TemplatesPage />} />
        <Route path="mensajeria/enlaces" element={<BroadcastPage />} />
        <Route path="devoluciones" element={<NewReturnPage />} />
        <Route path="devoluciones/nueva" element={<NewReturnPage />} />
        <Route path="devoluciones/:id" element={<ReturnDetailPage />} />
        <Route path="cajas" element={<CashSessionsListPage />} />
        <Route path="cobranza" element={<AgingPage />} />
        <Route path="cobranza/clientes/:clientId" element={<AccountStatementPage />} />

      </Route>
      <Route element={<CartProvider><Outlet /></CartProvider>}>
        <Route path="/catalogo/:token" element={<CatalogPage />} />
        <Route path="/catalogo/:token/pedido" element={<CheckoutPage />} />
      </Route>
      <Route path="/catalogo/:token/confirmacion" element={<OrderConfirmationPage />} />
      <Route path="/ruta" element={<FieldGate />}>
        <Route index element={<TodayRoutePage />} />
        <Route path="pedido/:clientId" element={<NewOrderPage />} />
        <Route path="entregas" element={<DeliveriesPage />} />
        <Route path="entregas/:orderId" element={<DeliveryPage />} />
        <Route path="caja" element={<CashSessionPage />} />
        <Route path="cobro/:clientId" element={<CollectPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}