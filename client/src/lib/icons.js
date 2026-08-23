import { Box, Gamepad2, Laptop, Monitor, Smartphone, Tablet, Watch } from 'lucide-react';

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

export default iconFor;
