/**
 * The Cellvix category tree: deviceType -> brand -> series -> model.
 *
 * This one structure feeds all three filter systems (sidebar, mega menu, tab
 * wizard). `icon` names are lucide icons and are used by the wizard's option cards.
 *
 * Replace wholesale when the client supplies their real catalogue export
 * (PROGRESS.md, open question #2).
 */

export const TAXONOMY = [
  {
    name: 'Smartphone',
    slug: 'smartphone',
    icon: 'Smartphone',
    featured: true,
    brands: [
      {
        name: 'Apple',
        slug: 'apple',
        featured: true,
        series: [
          {
            name: 'iPhone 15 Series',
            slug: 'iphone-15-series',
            models: ['iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max'],
          },
          {
            name: 'iPhone 14 Series',
            slug: 'iphone-14-series',
            models: ['iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max'],
          },
          {
            name: 'iPhone 13 Series',
            slug: 'iphone-13-series',
            models: ['iPhone 13 mini', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max'],
          },
          {
            name: 'iPhone 12 Series',
            slug: 'iphone-12-series',
            models: ['iPhone 12 mini', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max'],
          },
          {
            name: 'iPhone SE Series',
            slug: 'iphone-se-series',
            models: ['iPhone SE 2020', 'iPhone SE 2022'],
          },
        ],
      },
      {
        name: 'Samsung',
        slug: 'samsung',
        featured: true,
        series: [
          {
            name: 'Galaxy S Series',
            slug: 'galaxy-s-series',
            models: [
              'Galaxy S21',
              'Galaxy S21 Ultra',
              'Galaxy S22',
              'Galaxy S22 Ultra',
              'Galaxy S23',
              'Galaxy S23 Ultra',
              'Galaxy S24',
              'Galaxy S24 Ultra',
            ],
          },
          {
            name: 'Galaxy A Series',
            slug: 'galaxy-a-series',
            models: ['Galaxy A14 5G', 'Galaxy A15 5G', 'Galaxy A25 5G', 'Galaxy A34 5G', 'Galaxy A54 5G'],
          },
          {
            name: 'Galaxy Note Series',
            slug: 'galaxy-note-series',
            models: ['Galaxy Note 10', 'Galaxy Note 20', 'Galaxy Note 20 Ultra'],
          },
          {
            name: 'Galaxy Z Series',
            slug: 'galaxy-z-series',
            models: ['Galaxy Z Flip 4', 'Galaxy Z Flip 5', 'Galaxy Z Fold 4', 'Galaxy Z Fold 5'],
          },
        ],
      },
      {
        name: 'Google',
        slug: 'google',
        featured: true,
        series: [
          { name: 'Pixel 6 Series', slug: 'pixel-6-series', models: ['Pixel 6', 'Pixel 6 Pro', 'Pixel 6a'] },
          { name: 'Pixel 7 Series', slug: 'pixel-7-series', models: ['Pixel 7', 'Pixel 7 Pro', 'Pixel 7a'] },
          { name: 'Pixel 8 Series', slug: 'pixel-8-series', models: ['Pixel 8', 'Pixel 8 Pro'] },
        ],
      },
      {
        name: 'Motorola',
        slug: 'motorola',
        series: [
          {
            name: 'Moto G Series',
            slug: 'moto-g-series',
            models: ['Moto G Power 2022', 'Moto G Stylus 2022', 'Moto G 5G 2023'],
          },
          { name: 'Edge Series', slug: 'moto-edge-series', models: ['Edge 2022', 'Edge Plus 2023'] },
        ],
      },
      {
        name: 'OnePlus',
        slug: 'oneplus',
        series: [
          { name: 'Nord Series', slug: 'oneplus-nord-series', models: ['Nord N20', 'Nord N30'] },
          { name: 'Flagship Series', slug: 'oneplus-flagship-series', models: ['OnePlus 10 Pro', 'OnePlus 11', 'OnePlus 12'] },
        ],
      },
    ],
  },

  {
    name: 'Tablet',
    slug: 'tablet',
    icon: 'Tablet',
    featured: true,
    brands: [
      {
        name: 'Apple',
        slug: 'apple-tablet',
        featured: true,
        series: [
          { name: 'iPad Series', slug: 'ipad-series', models: ['iPad 9th Gen', 'iPad 10th Gen'] },
          { name: 'iPad Air Series', slug: 'ipad-air-series', models: ['iPad Air 4', 'iPad Air 5'] },
          {
            name: 'iPad Pro Series',
            slug: 'ipad-pro-series',
            models: ['iPad Pro 11 M2', 'iPad Pro 12.9 M2'],
          },
          { name: 'iPad mini Series', slug: 'ipad-mini-series', models: ['iPad mini 6'] },
        ],
      },
      {
        name: 'Samsung',
        slug: 'samsung-tablet',
        featured: true,
        series: [
          {
            name: 'Galaxy Tab S Series',
            slug: 'galaxy-tab-s-series',
            models: ['Galaxy Tab S7', 'Galaxy Tab S8', 'Galaxy Tab S9'],
          },
          {
            name: 'Galaxy Tab A Series',
            slug: 'galaxy-tab-a-series',
            models: ['Galaxy Tab A7', 'Galaxy Tab A8'],
          },
        ],
      },
      {
        name: 'Lenovo',
        slug: 'lenovo-tablet',
        series: [{ name: 'Tab M Series', slug: 'lenovo-tab-m-series', models: ['Tab M8', 'Tab M10'] }],
      },
    ],
  },

  {
    name: 'Laptop',
    slug: 'laptop',
    icon: 'Laptop',
    featured: true,
    brands: [
      {
        name: 'Apple',
        slug: 'apple-laptop',
        featured: true,
        series: [
          {
            name: 'MacBook Air Series',
            slug: 'macbook-air-series',
            models: ['MacBook Air M1 13', 'MacBook Air M2 13', 'MacBook Air M2 15'],
          },
          {
            name: 'MacBook Pro Series',
            slug: 'macbook-pro-series',
            models: ['MacBook Pro 14 M2', 'MacBook Pro 16 M2'],
          },
        ],
      },
      {
        name: 'Dell',
        slug: 'dell',
        series: [
          { name: 'XPS Series', slug: 'dell-xps-series', models: ['XPS 13 9310', 'XPS 15 9520'] },
          {
            name: 'Latitude Series',
            slug: 'dell-latitude-series',
            models: ['Latitude 5420', 'Latitude 7420'],
          },
        ],
      },
      {
        name: 'HP',
        slug: 'hp',
        series: [
          { name: 'Pavilion Series', slug: 'hp-pavilion-series', models: ['Pavilion 14', 'Pavilion 15'] },
          { name: 'EliteBook Series', slug: 'hp-elitebook-series', models: ['EliteBook 840 G8'] },
        ],
      },
      {
        name: 'Lenovo',
        slug: 'lenovo-laptop',
        series: [
          {
            name: 'ThinkPad Series',
            slug: 'thinkpad-series',
            models: ['ThinkPad T14', 'ThinkPad X1 Carbon Gen 9'],
          },
        ],
      },
    ],
  },

  {
    name: 'Smart Watch',
    slug: 'smart-watch',
    icon: 'Watch',
    featured: true,
    brands: [
      {
        name: 'Apple',
        slug: 'apple-watch',
        featured: true,
        series: [
          {
            name: 'Apple Watch Series',
            slug: 'apple-watch-series',
            models: ['Apple Watch Series 7', 'Apple Watch Series 8', 'Apple Watch Series 9'],
          },
          {
            name: 'Apple Watch Ultra',
            slug: 'apple-watch-ultra-series',
            models: ['Apple Watch Ultra', 'Apple Watch Ultra 2'],
          },
          { name: 'Apple Watch SE', slug: 'apple-watch-se-series', models: ['Apple Watch SE 2'] },
        ],
      },
      {
        name: 'Samsung',
        slug: 'samsung-watch',
        series: [
          {
            name: 'Galaxy Watch Series',
            slug: 'galaxy-watch-series',
            models: ['Galaxy Watch 4', 'Galaxy Watch 5', 'Galaxy Watch 6'],
          },
        ],
      },
    ],
  },

  {
    name: 'Game Console',
    slug: 'game-console',
    icon: 'Gamepad2',
    featured: true,
    brands: [
      {
        name: 'Sony',
        slug: 'sony',
        featured: true,
        series: [
          { name: 'PlayStation 4', slug: 'playstation-4-series', models: ['PS4 Slim', 'PS4 Pro'] },
          { name: 'PlayStation 5', slug: 'playstation-5-series', models: ['PS5', 'PS5 Slim'] },
        ],
      },
      {
        name: 'Microsoft',
        slug: 'microsoft',
        series: [
          { name: 'Xbox One', slug: 'xbox-one-series', models: ['Xbox One S', 'Xbox One X'] },
          { name: 'Xbox Series', slug: 'xbox-series-series', models: ['Xbox Series S', 'Xbox Series X'] },
        ],
      },
      {
        name: 'Nintendo',
        slug: 'nintendo',
        series: [
          {
            name: 'Switch Series',
            slug: 'nintendo-switch-series',
            models: ['Switch', 'Switch Lite', 'Switch OLED'],
          },
        ],
      },
    ],
  },

  {
    name: 'Computer',
    slug: 'computer',
    icon: 'Monitor',
    brands: [
      {
        name: 'Apple',
        slug: 'apple-computer',
        series: [
          { name: 'iMac Series', slug: 'imac-series', models: ['iMac 24 M1'] },
          { name: 'Mac mini Series', slug: 'mac-mini-series', models: ['Mac mini M2'] },
        ],
      },
      {
        name: 'Dell',
        slug: 'dell-computer',
        series: [{ name: 'OptiPlex Series', slug: 'optiplex-series', models: ['OptiPlex 7090'] }],
      },
      {
        name: 'HP',
        slug: 'hp-computer',
        series: [{ name: 'ProDesk Series', slug: 'prodesk-series', models: ['ProDesk 600 G6'] }],
      },
    ],
  },
];

/**
 * Which part types exist for each device type, with a base price band in cents
 * and the grades that part is realistically sold in.
 */
export const PART_TYPES = {
  smartphone: [
    { slug: 'screen-assembly', label: 'Screen Assembly', price: [4500, 32000], grades: ['NEW', 'OEM', 'PULL-A', 'PULL-B', 'AFTERMARKET'] },
    { slug: 'battery', label: 'Battery', price: [1200, 4800], grades: ['NEW', 'OEM', 'AFTERMARKET'] },
    { slug: 'charging-port', label: 'Charging Port Flex', price: [800, 3600], grades: ['NEW', 'OEM', 'PULL-A'] },
    { slug: 'back-glass', label: 'Back Glass', price: [900, 5200], grades: ['NEW', 'AFTERMARKET'] },
    { slug: 'rear-camera', label: 'Rear Camera', price: [1800, 9500], grades: ['OEM', 'PULL-A', 'PULL-B'] },
    { slug: 'front-camera', label: 'Front Camera', price: [1100, 4200], grades: ['OEM', 'PULL-A'] },
    { slug: 'loud-speaker', label: 'Loud Speaker', price: [600, 2400], grades: ['NEW', 'PULL-A'] },
    { slug: 'earpiece', label: 'Earpiece Speaker', price: [500, 1900], grades: ['NEW', 'PULL-A'] },
    { slug: 'sim-tray', label: 'SIM Tray', price: [200, 900], grades: ['NEW', 'AFTERMARKET'] },
    { slug: 'housing-frame', label: 'Housing / Mid Frame', price: [1600, 7800], grades: ['NEW', 'PULL-A', 'PULL-B'] },
  ],
  tablet: [
    { slug: 'screen-assembly', label: 'Screen Assembly', price: [6800, 44000], grades: ['NEW', 'OEM', 'PULL-A', 'AFTERMARKET'] },
    { slug: 'battery', label: 'Battery', price: [2400, 8900], grades: ['NEW', 'OEM'] },
    { slug: 'charging-port', label: 'Charging Port Flex', price: [1100, 4200], grades: ['NEW', 'OEM', 'PULL-A'] },
    { slug: 'digitizer', label: 'Digitizer Glass', price: [2200, 12000], grades: ['NEW', 'AFTERMARKET'] },
    { slug: 'housing-frame', label: 'Rear Housing', price: [3200, 14000], grades: ['PULL-A', 'PULL-B'] },
    { slug: 'loud-speaker', label: 'Speaker Set', price: [900, 3400], grades: ['NEW', 'PULL-A'] },
  ],
  laptop: [
    { slug: 'lcd-panel', label: 'LCD Panel', price: [7900, 46000], grades: ['NEW', 'OEM', 'PULL-A'] },
    { slug: 'battery', label: 'Battery', price: [4200, 16500], grades: ['NEW', 'OEM', 'AFTERMARKET'] },
    { slug: 'keyboard', label: 'Keyboard Assembly', price: [2900, 18000], grades: ['NEW', 'OEM', 'PULL-A'] },
    { slug: 'trackpad', label: 'Trackpad', price: [2400, 12500], grades: ['OEM', 'PULL-A', 'PULL-B'] },
    { slug: 'hinge-set', label: 'Hinge Set', price: [1400, 5600], grades: ['NEW', 'PULL-A'] },
    { slug: 'charging-board', label: 'Charging Board', price: [1900, 8800], grades: ['NEW', 'OEM', 'PULL-A'] },
    { slug: 'cooling-fan', label: 'Cooling Fan', price: [1200, 6400], grades: ['NEW', 'PULL-A'] },
    { slug: 'bottom-cover', label: 'Bottom Cover', price: [1800, 9200], grades: ['PULL-A', 'PULL-B'] },
  ],
  'smart-watch': [
    { slug: 'screen-assembly', label: 'Screen Assembly', price: [3900, 21000], grades: ['NEW', 'OEM', 'PULL-A'] },
    { slug: 'battery', label: 'Battery', price: [900, 3800], grades: ['NEW', 'OEM'] },
    { slug: 'back-cover', label: 'Back Cover Sensor', price: [1400, 6800], grades: ['OEM', 'PULL-A'] },
    { slug: 'digital-crown', label: 'Digital Crown', price: [1100, 4900], grades: ['OEM', 'PULL-A'] },
  ],
  'game-console': [
    { slug: 'controller-stick', label: 'Controller Joystick', price: [400, 1800], grades: ['NEW', 'AFTERMARKET'] },
    { slug: 'hdmi-port', label: 'HDMI Port', price: [600, 2600], grades: ['NEW', 'OEM'] },
    { slug: 'cooling-fan', label: 'Cooling Fan', price: [1800, 7400], grades: ['NEW', 'PULL-A'] },
    { slug: 'power-supply', label: 'Power Supply Unit', price: [2600, 11000], grades: ['NEW', 'PULL-A'] },
    { slug: 'optical-drive', label: 'Optical Drive', price: [3400, 14500], grades: ['PULL-A', 'PULL-B'] },
    { slug: 'housing-frame', label: 'Shell / Housing', price: [1600, 7200], grades: ['NEW', 'AFTERMARKET'] },
  ],
  computer: [
    { slug: 'lcd-panel', label: 'Display Panel', price: [12000, 58000], grades: ['NEW', 'OEM', 'PULL-A'] },
    { slug: 'power-supply', label: 'Power Supply Unit', price: [3800, 15000], grades: ['NEW', 'PULL-A'] },
    { slug: 'cooling-fan', label: 'Cooling Fan', price: [1400, 6200], grades: ['NEW', 'PULL-A'] },
    { slug: 'logic-board', label: 'Logic Board', price: [18000, 92000], grades: ['OEM', 'PULL-A', 'PULL-B'] },
  ],
};

/** Grade affects price: a B-grade pull is worth less than a new part. */
export const GRADE_MULTIPLIER = {
  NEW: 1,
  OEM: 1.18,
  'PULL-A': 0.78,
  'PULL-B': 0.58,
  AFTERMARKET: 0.62,
};
