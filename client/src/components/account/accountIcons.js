import {
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  MapPin,
  Package,
  Wallet,
  Zap,
} from 'lucide-react';

/**
 * Icon registry for ACCOUNT_NAV, whose `icon` is a string in the shared schema.
 * One registry so the sidebar and the header dropdown cannot drift, and so the
 * bundle takes eight icons rather than all of lucide.
 */
const REGISTRY = {
  LayoutDashboard,
  Package,
  FileText,
  Wallet,
  Zap,
  MapPin,
  CreditCard,
  Building2,
};

export function accountIcon(name) {
  return REGISTRY[name] ?? LayoutDashboard;
}

export default accountIcon;
