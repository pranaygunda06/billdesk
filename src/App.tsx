import { Route, Routes, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Products from './pages/Products';
import Billing from './pages/Billing';
import InvoiceDetail from './pages/InvoiceDetail';
import Reports from './pages/Reports';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import Pay from './pages/Pay';
import Login from './pages/Login';

export default function App() {
  return (
    <Routes>
      {/* Public customer routes — no login */}
      <Route path="/pay/:token" element={<Pay />} />
      <Route path="/p/:token" element={<Pay />} />
      <Route path="/login" element={<Login />} />

      {/* Admin routes — require Firebase Auth */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/products" element={<Products />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
