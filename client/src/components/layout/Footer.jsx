import { Link } from 'react-router';
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Youtube } from 'lucide-react';
import { BUSINESS_INFO } from '@/lib/constants';

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      { label: 'All parts', to: '/' },
      { label: 'Phone parts', to: '/?deviceType=smartphone' },
      { label: 'Tablet parts', to: '/?deviceType=tablet' },
      { label: 'Laptop parts', to: '/?deviceType=laptop' },
      { label: 'Console parts', to: '/?deviceType=game-console' },
      { label: 'Offers & combo deals', to: '/offers' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Dashboard', to: '/account' },
      { label: 'Order history', to: '/account/orders' },
      { label: 'Invoices & statements', to: '/account/invoices' },
      { label: 'Quick order pad', to: '/account/quick-order' },
      { label: 'Saved addresses', to: '/account/addresses' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About us', to: '/about' },
      { label: 'Blog', to: '/blog' },
      { label: 'FAQ', to: '/faq' },
      { label: 'Contact us', to: '/contact' },
    ],
  },
];

const SOCIAL = [
  { icon: Facebook, key: 'facebook', label: 'Facebook' },
  { icon: Instagram, key: 'instagram', label: 'Instagram' },
  { icon: Linkedin, key: 'linkedin', label: 'LinkedIn' },
  { icon: Youtube, key: 'youtube', label: 'YouTube' },
];

export function Footer() {
  return (
    <footer className="mt-14 border-t border-line bg-surface">
      {/* The gradient as a hairline rule — accent, not fill. */}
      <div className="rule-brand-gradient h-0.5" aria-hidden="true" />

      <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-6 lg:py-14">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <img
              src="/brand/logo.png"
              srcSet="/brand/logo.png 1x, /brand/logo@2x.png 2x"
              alt={`${BUSINESS_INFO.name} — ${BUSINESS_INFO.tagline}`}
              width="1000"
              height="254"
              className="h-9 w-auto"
            />

            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-ink-500">
              Canadian wholesale supplier of replacement parts for phones, tablets, laptops,
              wearables and consoles. Trade accounts only.
            </p>

            <ul className="mt-5 space-y-2 text-[13px] text-ink-500">
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
                <a href={`tel:${BUSINESS_INFO.phone.replace(/[^\d+]/g, '')}`} className="hover:text-brand">
                  {BUSINESS_INFO.phone}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
                <a href={`mailto:${BUSINESS_INFO.email}`} className="hover:text-brand">
                  {BUSINESS_INFO.email}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
                <span>
                  {BUSINESS_INFO.address.line1}
                  <br />
                  {BUSINESS_INFO.address.city}, {BUSINESS_INFO.address.region}{' '}
                  {BUSINESS_INFO.address.postal}
                </span>
              </li>
            </ul>

            <div className="mt-5 flex gap-2">
              {SOCIAL.map(({ icon: Icon, key, label }) => (
                <a
                  key={key}
                  href={BUSINESS_INFO.social[key]}
                  aria-label={label}
                  className="flex size-9 items-center justify-center rounded-full border border-line text-ink-400 transition-colors hover:border-brand hover:text-brand"
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="eyebrow mb-3.5 text-ink-400">{column.title}</h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-[13.5px] text-ink-500 transition-colors hover:text-brand"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-5 text-[12.5px] text-ink-400 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <p>
            © {new Date().getFullYear()} {BUSINESS_INFO.name}. All prices in CAD.
          </p>
          <p className="flex items-center gap-4">
            <Link to="/contact" className="hover:text-brand">
              Privacy
            </Link>
            <Link to="/contact" className="hover:text-brand">
              Terms
            </Link>
            <span className="text-ink-300">{BUSINESS_INFO.domain}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
