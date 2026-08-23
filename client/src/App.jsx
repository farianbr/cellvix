import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router';
import RootLayout from '@/components/layout/RootLayout';
import ShopPage from '@/pages/ShopPage';
import RouteFallback from '@/components/layout/RouteFallback';

/**
 * The Shop page owns "/" and is the landing surface for every visitor, so it
 * ships in the main bundle. Everything else is split: a guest browsing the
 * catalogue should never download the account dashboard.
 */
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage'));
const CartPage = lazy(() => import('@/pages/CartPage'));
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'));
const ThankYouPage = lazy(() => import('@/pages/ThankYouPage'));
const PaymentFailedPage = lazy(() => import('@/pages/PaymentFailedPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const BlogPage = lazy(() => import('@/pages/BlogPage'));
const BlogPostPage = lazy(() => import('@/pages/BlogPostPage'));
const FaqPage = lazy(() => import('@/pages/FaqPage'));
const OffersPage = lazy(() => import('@/pages/OffersPage'));

const AccountLayout = lazy(() => import('@/components/account/AccountLayout'));
const AccountOverviewPage = lazy(() => import('@/pages/account/AccountOverviewPage'));
const AccountOrdersPage = lazy(() => import('@/pages/account/AccountOrdersPage'));
const AccountOrderDetailPage = lazy(() => import('@/pages/account/AccountOrderDetailPage'));
const AccountInvoicesPage = lazy(() => import('@/pages/account/AccountInvoicesPage'));
const AccountCreditPage = lazy(() => import('@/pages/account/AccountCreditPage'));
const AccountQuickOrderPage = lazy(() => import('@/pages/account/AccountQuickOrderPage'));
const AccountAddressesPage = lazy(() => import('@/pages/account/AccountAddressesPage'));
const AccountPaymentMethodsPage = lazy(() => import('@/pages/account/AccountPaymentMethodsPage'));
const AccountCompanyPage = lazy(() => import('@/pages/account/AccountCompanyPage'));

const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'));
const AdminOverviewPage = lazy(() => import('@/pages/admin/AdminOverviewPage'));
const AdminApprovalsPage = lazy(() => import('@/pages/admin/AdminApprovalsPage'));
const AdminOrdersPage = lazy(() => import('@/pages/admin/AdminOrdersPage'));
const AdminProductsPage = lazy(() => import('@/pages/admin/AdminProductsPage'));
const AdminCustomersPage = lazy(() => import('@/pages/admin/AdminCustomersPage'));
const AdminOffersPage = lazy(() => import('@/pages/admin/AdminOffersPage'));
const AdminBlogPage = lazy(() => import('@/pages/admin/AdminBlogPage'));
const AdminFaqPage = lazy(() => import('@/pages/admin/AdminFaqPage'));

export function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<ShopPage />} />

        <Route
          path="product/:slug"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ProductDetailPage />
            </Suspense>
          }
        />

        <Route
          path="cart"
          element={
            <Suspense fallback={<RouteFallback />}>
              <CartPage />
            </Suspense>
          }
        />
        <Route
          path="checkout"
          element={
            <Suspense fallback={<RouteFallback />}>
              <CheckoutPage />
            </Suspense>
          }
        />
        <Route
          path="thank-you/:orderNumber"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ThankYouPage />
            </Suspense>
          }
        />

        {/* Reached from checkout when the charge is refused. Nothing has been
            written at that point, so the cart is still intact. */}
        <Route
          path="payment-failed"
          element={
            <Suspense fallback={<RouteFallback />}>
              <PaymentFailedPage />
            </Suspense>
          }
        />

        {/* AccountLayout is also the auth gate for everything beneath it. */}
        <Route
          path="account"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AccountLayout />
            </Suspense>
          }
        >
          <Route index element={<AccountOverviewPage />} />
          <Route path="orders" element={<AccountOrdersPage />} />
          <Route path="orders/:orderNumber" element={<AccountOrderDetailPage />} />
          <Route path="invoices" element={<AccountInvoicesPage />} />
          <Route path="credit" element={<AccountCreditPage />} />
          <Route path="quick-order" element={<AccountQuickOrderPage />} />
          <Route path="addresses" element={<AccountAddressesPage />} />
          <Route path="payment-methods" element={<AccountPaymentMethodsPage />} />
          <Route path="company" element={<AccountCompanyPage />} />
        </Route>

        {/* AdminLayout is also the route guard; requireAdmin enforces it server-side. */}
        <Route
          path="admin"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AdminLayout />
            </Suspense>
          }
        >
          <Route index element={<AdminOverviewPage />} />
          <Route path="approvals" element={<AdminApprovalsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="offers" element={<AdminOffersPage />} />
          <Route path="blog" element={<AdminBlogPage />} />
          <Route path="faqs" element={<AdminFaqPage />} />
        </Route>
        <Route
          path="about"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AboutPage />
            </Suspense>
          }
        />
        <Route
          path="contact"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ContactPage />
            </Suspense>
          }
        />

        <Route
          path="offers"
          element={
            <Suspense fallback={<RouteFallback />}>
              <OffersPage />
            </Suspense>
          }
        />
        <Route
          path="blog"
          element={
            <Suspense fallback={<RouteFallback />}>
              <BlogPage />
            </Suspense>
          }
        />
        <Route
          path="blog/:slug"
          element={
            <Suspense fallback={<RouteFallback />}>
              <BlogPostPage />
            </Suspense>
          }
        />
        <Route
          path="faq"
          element={
            <Suspense fallback={<RouteFallback />}>
              <FaqPage />
            </Suspense>
          }
        />

        <Route
          path="*"
          element={
            <Suspense fallback={<RouteFallback />}>
              <NotFoundPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
