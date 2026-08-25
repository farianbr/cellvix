import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Youtube } from 'lucide-react';
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

/**
 * Warehouse-local time, so the trade desk hours above it mean something to a
 * buyer in Vancouver. Ticks on the minute rather than the second — nothing here
 * is worth a repaint a second, and the reader cannot see the difference.
 */
function useEasternTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return now.toLocaleTimeString('en-CA', {
    timeZone: 'America/Toronto',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * The footer.
 *
 * One rounded slab that sits IN the page rather than a full-bleed band ruled off
 * the bottom of it — the old version was four equal columns of grey links and
 * read as a sitemap dump. The weight is redistributed: a statement and the
 * contact details carry the left, the navigation is three tight columns in the
 * middle, and the two things a buyer actually wants from a footer (talk to
 * someone, open an account) are the only accented elements on the page.
 *
 * The wordmark underneath is the brand at the size it deserves once, at the end,
 * where nothing has to compete with it.
 */
export function Footer() {
  const time = useEasternTime();

  return (
    <footer className="mt-14 px-3 pb-3 sm:px-4 sm:pb-4 lg:px-6 lg:pb-6">
      {/* Two boxes, not one: a rounded panel that holds the content and clips
          the wordmark, and the fine print sitting outside it on the page's own
          surface. The wordmark is cropped BY that panel's rounded bottom edge —
          it is a texture the footer ends on, not a logo to be read, and letting
          it run out of the box is what stops it reading as a fifth column. */}
      <div className="mx-auto max-w-[1400px] overflow-hidden rounded-[28px] bg-surface-2 ring-1 ring-line">
        {/* The gradient as a hairline rule — accent, not fill. */}
        <div className="rule-brand-gradient h-1" aria-hidden="true" />

        <div className="px-5 pt-8 sm:px-7 lg:px-10 lg:pt-12">
          {/* 4 / 5 / 3 of twelve from lg up. Below that everything stacks and
              the three link columns share their own row, so "Company" never
              sits alone beside half a column of empty surface. */}
          <div className="grid gap-x-8 gap-y-10 lg:grid-cols-12">
            {/* ---- statement + reach ------------------------------------- */}
            <div className="lg:col-span-4">
              <h2 className="max-w-sm font-display text-[19px] font-bold leading-snug text-ink-900 sm:text-[21px]">
                Cellvix keeps Canadian repair shops in graded parts, at trade
                prices, on terms.
              </h2>

              <ul className="mt-6 space-y-2.5 text-[13px] text-ink-500">
                <li className="flex items-center gap-2.5">
                  <Phone className="size-4 shrink-0 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
                  <a
                    href={`tel:${BUSINESS_INFO.phone.replace(/[^\d+]/g, '')}`}
                    className="transition-colors hover:text-brand"
                  >
                    {BUSINESS_INFO.phone}
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="size-4 shrink-0 text-ink-300" strokeWidth={1.75} aria-hidden="true" />
                  <a
                    href={`mailto:${BUSINESS_INFO.email}`}
                    className="transition-colors hover:text-brand"
                  >
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

              {/* Handle beside the glyph: a row of bare circles told a reader
                  which networks exist, not which account they land on. */}
              <div className="mt-6">
                <h3 className="eyebrow mb-3 text-ink-400">Follow us</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {SOCIAL.map(({ icon: Icon, key, label }) => (
                    <li key={key}>
                      <a
                        href={BUSINESS_INFO.social[key]}
                        aria-label={label}
                        className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1.5 pl-2 pr-2.5 text-[12px] font-medium text-ink-500 transition-colors hover:border-brand hover:text-brand"
                      >
                        <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                        {BUSINESS_INFO.handles[key]}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ---- navigation -------------------------------------------- */}
            <div className="grid gap-x-6 gap-y-8 sm:grid-cols-3 lg:col-span-5">
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

            {/* ---- the two calls to action ------------------------------- */}
            <div className="lg:col-span-3">
              <a
                href={`tel:${BUSINESS_INFO.phone.replace(/[^\d+]/g, '')}`}
                className="group block"
              >
                <span className="flex items-center gap-2 font-display text-[17px] font-bold text-brand transition-colors group-hover:text-brand-700">
                  Call the desk
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                    <ArrowUpRight className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                  </span>
                </span>
                <span className="mt-1 block text-[12.5px] text-ink-400">
                  {BUSINESS_INFO.hours[0].days} · {BUSINESS_INFO.hours[0].time}
                </span>
              </a>

              <hr className="my-4 border-line" />

              <Link to="/contact" className="group block">
                <span className="flex items-center gap-2 font-display text-[17px] font-bold text-ink-900 transition-colors group-hover:text-brand">
                  Open an account
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-500 transition-[transform,border-color,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:border-brand group-hover:text-brand">
                    <ArrowUpRight className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                  </span>
                </span>
                <span className="mt-1 block text-[12.5px] text-ink-400">
                  Trade pricing in one business day
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* ---- the wordmark ------------------------------------------------
            The real mark, not type set to look like it. This is the CELLV*X
            wordmark lifted out of the client's lockup and flattened to its
            black-and-leaf colourway — the letters carry the logo's own grunge
            texture, which no font can stand in for, and the maple leaf is the
            brand's, not a red `o`. The tagline and domain that ride along in
            the full lockup are dropped: at this size they would shout three
            things where the footer wants one quiet one.

            The asset is trimmed to its ink, so `w-full` puts the C and the X
            flush against both edges of the panel — which is why this block has
            no side padding.

            The crop: the wrapper's aspect ratio is the image's own width over
            70% of its height, and the image is pinned to the wrapper's top at
            full width. So exactly the top 70% shows and the bottom 30% is cut
            — the word runs out of the panel rather than sitting in it, which
            is what stops it reading as a fifth column. Nothing under it on
            purpose; the panel's rounded bottom edge does the rest of the
            clipping.

            Decorative — the header carries the accessible name. */}
        <div className="pt-8 lg:pt-10">
          <div className="relative aspect-2456/305 w-full overflow-hidden">
            <img
              src="/brand/wordmark.png"
              alt=""
              aria-hidden="true"
              draggable="false"
              loading="lazy"
              decoding="async"
              className="pointer-events-none absolute inset-x-0 top-0 w-full select-none"
            />
          </div>
        </div>
      </div>

      {/* ---- the fine print ------------------------------------------------
          Outside the panel, on the page's own surface — the panel ends on the
          cropped wordmark, and a rule under it would undo the crop. */}
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-2 pt-4 text-[12.5px] text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-4 lg:px-6">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            {BUSINESS_INFO.name} ©{new Date().getFullYear()}
          </span>
          <Link to="/contact" className="transition-colors hover:text-brand">
            Privacy
          </Link>
          <Link to="/contact" className="transition-colors hover:text-brand">
            Terms
          </Link>
        </p>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{BUSINESS_INFO.address.city}</span>
          <span className="tnum" aria-label={`Warehouse local time ${time}`}>
            {time}
          </span>
          <span className="text-ink-300">All prices CAD</span>
        </p>
      </div>
    </footer>
  );
}

export default Footer;
