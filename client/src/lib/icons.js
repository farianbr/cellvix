import {
  Battery,
  Box,
  Cable,
  Camera,
  CircuitBoard,
  Cpu,
  Disc,
  Fan,
  Gamepad2,
  HardDrive,
  Keyboard,
  Laptop,
  Layers,
  Monitor,
  Plug,
  RectangleHorizontal,
  ScanLine,
  Smartphone,
  SquareMousePointer,
  Tablet,
  Tv,
  Usb,
  Volume2,
  Watch,
} from 'lucide-react';

/**
 * Explicit registry for icon names that arrive as strings from the API
 * (Taxonomy.icon). A `import * as Icons from 'lucide-react'` lookup would work
 * too — and would pull all ~1500 icons into the bundle. Add a device type here
 * when the taxonomy gains one.
 */
const REGISTRY = {
  Smartphone,
  Tablet,
  Laptop,
  Watch,
  Gamepad2,
  Monitor,
};

/** Resolves a stored icon name, falling back to a neutral box. */
export function iconFor(name) {
  return REGISTRY[name] ?? Box;
}

/**
 * partType slug -> icon.
 *
 * A component type is the one taxonomy level with an honest picture available:
 * a battery, a fan and a keyboard all look like something, and a buyer scanning
 * twenty-five of them reads a glyph faster than a word. Brands and models have
 * no such picture — an invented mark there would be a logo we do not own — so
 * only this level gets icons.
 *
 * Listed explicitly rather than resolved dynamically, for the same bundle
 * reason as REGISTRY above.
 */
const COMPONENT_ICONS = {
  'screen-assembly': Smartphone,
  'lcd-panel': Monitor,
  digitizer: ScanLine,
  battery: Battery,
  'charging-port': Usb,
  'charging-board': CircuitBoard,
  'hdmi-port': Tv,
  'back-glass': Layers,
  'back-cover': Layers,
  'bottom-cover': Layers,
  'rear-camera': Camera,
  'front-camera': Camera,
  'loud-speaker': Volume2,
  earpiece: Volume2,
  'sim-tray': RectangleHorizontal,
  'housing-frame': Smartphone,
  keyboard: Keyboard,
  trackpad: SquareMousePointer,
  'flex-cable': Cable,
  'hinge-set': Cable,
  'cooling-fan': Fan,
  'digital-crown': Watch,
  'controller-stick': Gamepad2,
  'power-supply': Plug,
  'optical-drive': Disc,
  'logic-board': Cpu,
  'storage-drive': HardDrive,
};

/** The icon for a component type, or a neutral box for one not yet mapped. */
export function componentIconFor(slug) {
  return COMPONENT_ICONS[slug] ?? Box;
}

export default iconFor;
