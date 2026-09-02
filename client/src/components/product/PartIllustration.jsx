import cn from '@/lib/cn';

/**
 * Line-art stand-in for a product photo.
 *
 * Cellvix has not supplied catalogue photography yet (PROGRESS.md open question
 * #6). Rather than fake photos or grey boxes, each part type gets a technical
 * drawing — so a grid of results still reads at a glance. `ProductCard` renders
 * `product.image` the moment real photography exists and never reaches here.
 */

const INK = 'var(--color-ink-700)';
const MUTED = 'var(--color-ink-200)'; // decorative stroke, never text
const ACCENT = 'var(--color-brand)';

const common = {
  fill: 'none',
  stroke: INK,
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const DRAWINGS = {
  screen: (
    <>
      <rect x="26" y="8" width="48" height="84" rx="7" {...common} />
      <rect x="31" y="16" width="38" height="68" rx="3" stroke={MUTED} fill="none" strokeWidth="1.2" />
      <path d="M42 12h16" stroke={MUTED} strokeWidth="2" strokeLinecap="round" />
      <path d="M50 84v4" stroke={MUTED} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M74 34l12 6-12 6" stroke={ACCENT} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),

  // A pouch cell, not a AA: soft-cornered foil envelope with one notched
  // corner, and the flex tab leaving the top edge into its board connector.
  battery: (
    <>
      <path
        d="M24 30h48a4 4 0 0 1 4 4v40a4 4 0 0 1-4 4H40l-8-8H24a4 4 0 0 1-4-4V34a4 4 0 0 1 4-4z"
        {...common}
      />
      <path
        d="M27 34h44v34H39l-8-8h-4z"
        stroke={MUTED}
        strokeWidth="1.1"
        fill="none"
        strokeLinejoin="round"
      />
      {/* flex tail up to the connector */}
      <path d="M64 30V22h8" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="70" y="17" width="12" height="8" rx="2" stroke={ACCENT} strokeWidth="1.5" fill="none" />
      <path d="M73 19v4M76 19v4M79 19v4" stroke={MUTED} strokeWidth="1" strokeLinecap="round" />
      <path d="M40 44l-7 14h9l-5 11" stroke={ACCENT} strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),

  // The charging flex as it actually ships: a long ribbon running up from the
  // port board at the bottom to the board connectors at the top, not a bare
  // socket floating in space.
  port: (
    <>
      {/* port board */}
      <path d="M22 76h44a3 3 0 0 0 3-3V62h-8V56h-9v-6H31a3 3 0 0 0-3 3v8h-6v12a3 3 0 0 0 0 3z" {...common} />
      <rect x="38" y="78" width="22" height="6" rx="3" stroke={ACCENT} strokeWidth="1.6" fill="none" />
      {/* ribbon */}
      <path d="M69 62V26" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M63 62V32" stroke={MUTED} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M63 32h6" stroke={MUTED} strokeWidth="1.1" strokeLinecap="round" />
      {/* board connectors */}
      <rect x="60" y="16" width="14" height="8" rx="2" {...common} />
      <rect x="76" y="20" width="10" height="7" rx="2" stroke={MUTED} strokeWidth="1.3" fill="none" />
      <path d="M63 18v4M66 18v4M69 18v4" stroke={MUTED} strokeWidth="1" strokeLinecap="round" />
      {/* screw bosses */}
      <circle cx="27" cy="58" r="2" stroke={MUTED} strokeWidth="1.2" fill="none" />
      <circle cx="64" cy="70" r="2" stroke={MUTED} strokeWidth="1.2" fill="none" />
    </>
  ),

  glass: (
    <>
      <rect x="28" y="10" width="44" height="80" rx="8" {...common} />
      <rect x="36" y="18" width="20" height="20" rx="5" stroke={MUTED} strokeWidth="1.3" fill="none" />
      <circle cx="42" cy="25" r="3" stroke={ACCENT} strokeWidth="1.4" fill="none" />
      <circle cx="50" cy="32" r="3" stroke={MUTED} strokeWidth="1.3" fill="none" />
      <path d="M36 74h28" stroke={MUTED} strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),

  // Rear camera: the triple cluster on its stepped bracket, lenses staggered
  // the way the module actually sits, with the flex leaving the bottom edge.
  camera: (
    <>
      <path d="M18 20h36v14h28a4 4 0 0 1 4 4v34a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z" {...common} />
      <circle cx="33" cy="35" r="12" stroke={INK} strokeWidth="1.5" fill="none" />
      <circle cx="33" cy="35" r="7" stroke={MUTED} strokeWidth="1.2" fill="none" />
      <circle cx="33" cy="61" r="12" stroke={INK} strokeWidth="1.5" fill="none" />
      <circle cx="33" cy="61" r="7" stroke={MUTED} strokeWidth="1.2" fill="none" />
      <circle cx="63" cy="50" r="13" stroke={INK} strokeWidth="1.5" fill="none" />
      <circle cx="63" cy="50" r="8" stroke={MUTED} strokeWidth="1.2" fill="none" />
      <circle cx="29" cy="31" r="2.2" fill={ACCENT} stroke="none" />
      {/* mounting holes + flex tail */}
      <circle cx="22" cy="26" r="1.8" stroke={MUTED} strokeWidth="1.2" fill="none" />
      <circle cx="80" cy="70" r="1.8" stroke={MUTED} strokeWidth="1.2" fill="none" />
      <path d="M50 76v8h-14" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="24" y="80" width="12" height="8" rx="2" stroke={ACCENT} strokeWidth="1.4" fill="none" />
    </>
  ),

  // Front camera: one lens on a narrow flex, not a three-lens island.
  cameraFront: (
    <>
      <rect x="30" y="30" width="40" height="26" rx="8" {...common} />
      <circle cx="43" cy="43" r="9" stroke={INK} strokeWidth="1.5" fill="none" />
      <circle cx="43" cy="43" r="4.5" stroke={MUTED} strokeWidth="1.2" fill="none" />
      <circle cx="40" cy="40" r="1.8" fill={ACCENT} stroke="none" />
      <circle cx="61" cy="43" r="4" stroke={MUTED} strokeWidth="1.3" fill="none" />
      <path d="M50 56v14h16" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="66" y="66" width="12" height="8" rx="2" stroke={ACCENT} strokeWidth="1.4" fill="none" />
      <path d="M69 68v4M72 68v4M75 68v4" stroke={MUTED} strokeWidth="1" strokeLinecap="round" />
    </>
  ),

  speaker: (
    <>
      <rect x="22" y="34" width="34" height="32" rx="6" {...common} />
      <circle cx="39" cy="50" r="9" stroke={MUTED} strokeWidth="1.3" fill="none" />
      <circle cx="39" cy="50" r="3.5" fill={ACCENT} stroke="none" />
      <path d="M64 40a13 13 0 0 1 0 20" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M72 33a23 23 0 0 1 0 34" stroke={MUTED} strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>
  ),

  tray: (
    <>
      <rect x="20" y="40" width="60" height="20" rx="4" {...common} />
      <rect x="30" y="45" width="26" height="10" rx="2" stroke={ACCENT} strokeWidth="1.5" fill="none" />
      <circle cx="72" cy="50" r="3" stroke={MUTED} strokeWidth="1.4" fill="none" />
      <path d="M20 50h-6" stroke={MUTED} strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),

  frame: (
    <>
      <rect x="28" y="8" width="44" height="84" rx="10" {...common} />
      <rect x="34" y="14" width="32" height="72" rx="6" stroke={MUTED} strokeWidth="1.2" fill="none" strokeDasharray="4 4" />
      <path d="M72 28v12M72 46v8M28 34v14" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),

  keyboard: (
    <>
      <rect x="12" y="30" width="76" height="42" rx="6" {...common} />
      <path
        d="M20 40h8M32 40h8M44 40h8M56 40h8M68 40h12M20 50h12M36 50h8M48 50h8M60 50h20M20 60h6M30 60h30M64 60h16"
        stroke={MUTED}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M30 60h30" stroke={ACCENT} strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),

  trackpad: (
    <>
      <rect x="20" y="28" width="60" height="44" rx="6" {...common} />
      <rect x="27" y="35" width="46" height="30" rx="3" stroke={MUTED} strokeWidth="1.2" fill="none" />
      <path d="M44 52l6-14 6 14-6-3z" stroke={ACCENT} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </>
  ),

  hinge: (
    <>
      <path d="M22 62h30l14-30" {...common} />
      <circle cx="52" cy="62" r="7" stroke={ACCENT} strokeWidth="1.8" fill="none" />
      <circle cx="52" cy="62" r="2" fill={INK} stroke="none" />
      <path d="M22 56v12" stroke={MUTED} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M64 28l10 4" stroke={MUTED} strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),

  fan: (
    <>
      <rect x="18" y="18" width="64" height="64" rx="10" {...common} />
      <circle cx="50" cy="50" r="22" stroke={MUTED} strokeWidth="1.3" fill="none" />
      <path
        d="M50 50c0-11 4-16 12-16-2 9-5 14-12 16zM50 50c-11 0-16-4-16-12 9 2 14 5 16 12zM50 50c0 11-4 16-12 16 2-9 5-14 12-16zM50 50c11 0 16 4 16 12-9-2-14-5-16-12z"
        stroke={INK}
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="50" r="4" fill={ACCENT} stroke="none" />
    </>
  ),

  crown: (
    <>
      <rect x="24" y="20" width="44" height="60" rx="12" {...common} />
      <rect x="30" y="27" width="32" height="46" rx="7" stroke={MUTED} strokeWidth="1.2" fill="none" />
      <rect x="68" y="40" width="10" height="14" rx="3" stroke={ACCENT} strokeWidth="1.6" fill="none" />
      <path d="M70 43v8M74 43v8" stroke={MUTED} strokeWidth="1.1" strokeLinecap="round" />
    </>
  ),

  stick: (
    <>
      <ellipse cx="50" cy="70" rx="26" ry="10" {...common} />
      <path d="M24 70V56a26 10 0 0 0 52 0v14" stroke={MUTED} strokeWidth="1.3" fill="none" />
      <rect x="44" y="30" width="12" height="26" rx="5" {...common} />
      <ellipse cx="50" cy="28" rx="14" ry="6" stroke={ACCENT} strokeWidth="1.8" fill="none" />
    </>
  ),

  psu: (
    <>
      <rect x="16" y="30" width="68" height="42" rx="6" {...common} />
      <circle cx="34" cy="51" r="11" stroke={MUTED} strokeWidth="1.3" fill="none" />
      <path d="M60 42h16M60 51h16M60 60h10" stroke={MUTED} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M50 40l-6 12h8l-5 10" stroke={ACCENT} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),

  drive: (
    <>
      <rect x="14" y="34" width="72" height="34" rx="5" {...common} />
      <path d="M22 44h44" stroke={MUTED} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="74" cy="57" r="4" stroke={ACCENT} strokeWidth="1.6" fill="none" />
      <path d="M22 58h30" stroke={MUTED} strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),

  board: (
    <>
      <rect x="16" y="22" width="68" height="56" rx="5" {...common} />
      <rect x="26" y="32" width="22" height="18" rx="2" stroke={MUTED} strokeWidth="1.3" fill="none" />
      <rect x="56" y="32" width="18" height="12" rx="2" stroke={ACCENT} strokeWidth="1.4" fill="none" />
      <path
        d="M26 58h12v10M46 56h10v12M62 52v16M70 52v16"
        stroke={MUTED}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="28" r="1.6" fill={MUTED} stroke="none" />
      <circle cx="78" cy="28" r="1.6" fill={MUTED} stroke="none" />
    </>
  ),
};

/** partType slug -> drawing. Unmapped types fall back to the circuit board. */
const MAP = {
  'screen-assembly': 'screen',
  digitizer: 'screen',
  'lcd-panel': 'screen',
  battery: 'battery',
  'charging-port': 'port',
  'charging-board': 'port',
  'hdmi-port': 'port',
  'back-glass': 'glass',
  'back-cover': 'glass',
  'bottom-cover': 'glass',
  'rear-camera': 'camera',
  'front-camera': 'cameraFront',
  'loud-speaker': 'speaker',
  earpiece: 'speaker',
  'sim-tray': 'tray',
  'housing-frame': 'frame',
  keyboard: 'keyboard',
  trackpad: 'trackpad',
  'flex-cable': 'hinge',
  'hinge-set': 'hinge',
  'cooling-fan': 'fan',
  'digital-crown': 'crown',
  'controller-stick': 'stick',
  'power-supply': 'psu',
  'optical-drive': 'drive',
  'logic-board': 'board',
};

export function PartIllustration({ partType, className, label }) {
  const drawing = DRAWINGS[MAP[partType] ?? 'board'];

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('size-full', className)}
      role="img"
      aria-label={label ? `${label} illustration` : 'Part illustration'}
    >
      {drawing}
    </svg>
  );
}

export default PartIllustration;
