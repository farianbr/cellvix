/**
 * A repair shop's starting lists: what it takes in, and what it charges for.
 *
 * **Two different things, and neither is the parts catalogue.** `DEVICE_TREE`
 * is what walks through the door; `SERVICES` is the labour sold on it. Parts are
 * the shop's own `Product` inventory and are seeded elsewhere.
 *
 * ## Why this list is not Cellvix's
 *
 * Cellvix's catalogue is smartphone-only, because that is what it has
 * photography for - a storefront rule that says nothing about what a technician
 * can fix. A repair shop takes in laptops, tablets, watches and consoles it will
 * never stock a part for, so the two lists genuinely differ and this one is
 * built from what CellShoppe repairs rather than from what Cellvix sells.
 *
 * Kept deliberately short at the model level. A real shop adds models as they
 * come in; seeding four hundred would fill the picker with devices nobody here
 * has ever seen, which is the opposite of useful at a counter.
 */

/**
 * `deviceType -> brand -> series -> model`.
 *
 * `aliases` are what a customer or a serial sticker actually says: somebody
 * reads `SM-S911B` off the back, or asks about "the S23". The picker searches
 * these as well as the name.
 */
const DEVICE_TREE = [
  {
    name: 'Phone',
    icon: 'Smartphone',
    order: 10,
    children: [
      {
        name: 'Apple',
        order: 10,
        children: [
          {
            name: 'iPhone 15',
            order: 10,
            children: [
              { name: 'iPhone 15', aliases: ['15'] },
              { name: 'iPhone 15 Plus', aliases: ['15 plus'] },
              { name: 'iPhone 15 Pro', aliases: ['15 pro'] },
              { name: 'iPhone 15 Pro Max', aliases: ['15 pm', '15 pro max'] },
            ],
          },
          {
            name: 'iPhone 14',
            order: 20,
            children: [
              { name: 'iPhone 14', aliases: ['14'] },
              { name: 'iPhone 14 Plus', aliases: ['14 plus'] },
              { name: 'iPhone 14 Pro', aliases: ['14 pro'] },
              { name: 'iPhone 14 Pro Max', aliases: ['14 pm', '14 pro max'] },
            ],
          },
          {
            name: 'iPhone 13',
            order: 30,
            children: [
              { name: 'iPhone 13', aliases: ['13'] },
              { name: 'iPhone 13 mini', aliases: ['13 mini'] },
              { name: 'iPhone 13 Pro', aliases: ['13 pro'] },
              { name: 'iPhone 13 Pro Max', aliases: ['13 pm', '13 pro max'] },
            ],
          },
          {
            name: 'iPhone 12',
            order: 40,
            children: [
              { name: 'iPhone 12', aliases: ['12'] },
              { name: 'iPhone 12 Pro', aliases: ['12 pro'] },
              { name: 'iPhone 12 Pro Max', aliases: ['12 pm'] },
            ],
          },
          {
            name: 'iPhone SE',
            order: 50,
            children: [
              { name: 'iPhone SE (2nd gen)', aliases: ['se 2020'] },
              { name: 'iPhone SE (3rd gen)', aliases: ['se 2022'] },
            ],
          },
        ],
      },
      {
        name: 'Samsung',
        order: 20,
        children: [
          {
            name: 'Galaxy S',
            order: 10,
            children: [
              { name: 'Galaxy S24', aliases: ['s24', 'sm-s921'] },
              { name: 'Galaxy S24 Ultra', aliases: ['s24 ultra', 'sm-s928'] },
              { name: 'Galaxy S23', aliases: ['s23', 'sm-s911'] },
              { name: 'Galaxy S23 Ultra', aliases: ['s23 ultra', 'sm-s918'] },
              { name: 'Galaxy S22', aliases: ['s22'] },
            ],
          },
          {
            name: 'Galaxy A',
            order: 20,
            children: [
              { name: 'Galaxy A54', aliases: ['a54'] },
              { name: 'Galaxy A34', aliases: ['a34'] },
              { name: 'Galaxy A15', aliases: ['a15'] },
            ],
          },
          {
            name: 'Galaxy Z',
            order: 30,
            children: [
              { name: 'Galaxy Z Flip 5', aliases: ['flip 5'] },
              { name: 'Galaxy Z Fold 5', aliases: ['fold 5'] },
            ],
          },
        ],
      },
      {
        name: 'Google',
        order: 30,
        children: [
          {
            name: 'Pixel',
            order: 10,
            children: [
              { name: 'Pixel 8', aliases: ['p8'] },
              { name: 'Pixel 8 Pro', aliases: ['p8 pro'] },
              { name: 'Pixel 7', aliases: ['p7'] },
              { name: 'Pixel 7a', aliases: ['p7a'] },
            ],
          },
        ],
      },
      {
        name: 'Motorola',
        order: 40,
        children: [
          {
            name: 'Moto G',
            order: 10,
            children: [{ name: 'Moto G54' }, { name: 'Moto G84' }],
          },
        ],
      },
      {
        // The catch-all a counter genuinely needs. Without it, an unusual
        // handset means somebody stops to add a node while a customer waits.
        name: 'Other',
        order: 90,
        children: [{ name: 'Other', order: 10, children: [{ name: 'Other phone' }] }],
      },
    ],
  },
  {
    name: 'Laptop',
    icon: 'Laptop',
    order: 20,
    children: [
      {
        name: 'Apple',
        order: 10,
        children: [
          {
            name: 'MacBook Air',
            order: 10,
            children: [
              { name: 'MacBook Air 13" (M1)', aliases: ['air m1'] },
              { name: 'MacBook Air 13" (M2)', aliases: ['air m2'] },
              { name: 'MacBook Air 15" (M3)', aliases: ['air m3'] },
            ],
          },
          {
            name: 'MacBook Pro',
            order: 20,
            children: [
              { name: 'MacBook Pro 14" (M3)', aliases: ['mbp 14'] },
              { name: 'MacBook Pro 16" (M3)', aliases: ['mbp 16'] },
            ],
          },
        ],
      },
      {
        name: 'Dell',
        order: 20,
        children: [
          {
            name: 'XPS',
            order: 10,
            children: [{ name: 'XPS 13' }, { name: 'XPS 15' }],
          },
          { name: 'Latitude', order: 20, children: [{ name: 'Latitude 5440' }] },
        ],
      },
      {
        name: 'Lenovo',
        order: 30,
        children: [
          {
            name: 'ThinkPad',
            order: 10,
            children: [{ name: 'ThinkPad X1 Carbon' }, { name: 'ThinkPad T14' }],
          },
          { name: 'IdeaPad', order: 20, children: [{ name: 'IdeaPad 3' }] },
        ],
      },
      { name: 'HP', order: 40, children: [{ name: 'Pavilion', order: 10, children: [{ name: 'Pavilion 15' }] }] },
      { name: 'Other', order: 90, children: [{ name: 'Other', order: 10, children: [{ name: 'Other laptop' }] }] },
    ],
  },
  {
    name: 'Tablet',
    icon: 'Tablet',
    order: 30,
    children: [
      {
        name: 'Apple',
        order: 10,
        children: [
          {
            name: 'iPad',
            order: 10,
            children: [
              { name: 'iPad (9th gen)' },
              { name: 'iPad (10th gen)' },
              { name: 'iPad Air (5th gen)' },
              { name: 'iPad Pro 11"' },
              { name: 'iPad Pro 12.9"' },
            ],
          },
        ],
      },
      {
        name: 'Samsung',
        order: 20,
        children: [
          { name: 'Galaxy Tab', order: 10, children: [{ name: 'Galaxy Tab S9' }, { name: 'Galaxy Tab A9' }] },
        ],
      },
      { name: 'Other', order: 90, children: [{ name: 'Other', order: 10, children: [{ name: 'Other tablet' }] }] },
    ],
  },
  {
    name: 'Watch',
    icon: 'Watch',
    order: 40,
    children: [
      {
        name: 'Apple',
        order: 10,
        children: [
          {
            name: 'Apple Watch',
            order: 10,
            children: [{ name: 'Apple Watch Series 9' }, { name: 'Apple Watch SE' }, { name: 'Apple Watch Ultra 2' }],
          },
        ],
      },
      {
        name: 'Samsung',
        order: 20,
        children: [{ name: 'Galaxy Watch', order: 10, children: [{ name: 'Galaxy Watch 6' }] }],
      },
    ],
  },
  {
    name: 'Console',
    icon: 'Gamepad2',
    order: 50,
    children: [
      {
        name: 'Sony',
        order: 10,
        children: [{ name: 'PlayStation', order: 10, children: [{ name: 'PlayStation 5' }, { name: 'PlayStation 4' }] }],
      },
      {
        name: 'Microsoft',
        order: 20,
        children: [{ name: 'Xbox', order: 10, children: [{ name: 'Xbox Series X' }, { name: 'Xbox Series S' }] }],
      },
      {
        name: 'Nintendo',
        order: 30,
        children: [{ name: 'Switch', order: 10, children: [{ name: 'Switch OLED' }, { name: 'Switch Lite' }] }],
      },
    ],
  },
];

/**
 * The labour price list.
 *
 * **Prices are a starting point, not a price.** The picker fills them into a
 * line and the staff member raises one for a bent frame or a seized screw, which is
 * the normal case rather than the exception.
 *
 * `cost` is what the work costs the shop - mostly bench time, since a part
 * fitted alongside carries its own cost on its own line. Left **undefined** on
 * the diagnostic and the data services rather than set to zero: an unknown cost
 * and a zero cost produce very different margins, and claiming an hour of
 * somebody's time is free is the second one.
 *
 * `deviceTypes` narrows the picker to the device being worked on. An empty list
 * means "offer it for anything", which is right for a diagnostic fee.
 */
const SERVICES = [
  // ---- screen ------------------------------------------------------------
  { name: 'Screen replacement', category: 'screen', price: 189, cost: 95, durationMinutes: 45, warrantyDays: 90, deviceTypes: ['phone'], order: 10 },
  { name: 'Screen replacement (laptop)', category: 'screen', price: 329, cost: 190, durationMinutes: 90, warrantyDays: 90, deviceTypes: ['laptop'], order: 11 },
  { name: 'Screen replacement (tablet)', category: 'screen', price: 249, cost: 140, durationMinutes: 75, warrantyDays: 90, deviceTypes: ['tablet'], order: 12 },
  { name: 'Back glass replacement', category: 'screen', price: 129, cost: 55, durationMinutes: 60, warrantyDays: 90, deviceTypes: ['phone'], order: 13 },
  { name: 'Digitiser only', category: 'screen', price: 119, cost: 60, durationMinutes: 45, warrantyDays: 90, deviceTypes: ['phone', 'tablet'], order: 14 },

  // ---- battery -----------------------------------------------------------
  { name: 'Battery replacement', category: 'battery', price: 89, cost: 38, durationMinutes: 30, warrantyDays: 180, deviceTypes: ['phone'], order: 20 },
  { name: 'Battery replacement (laptop)', category: 'battery', price: 169, cost: 85, durationMinutes: 60, warrantyDays: 180, deviceTypes: ['laptop'], order: 21 },
  { name: 'Battery replacement (tablet)', category: 'battery', price: 139, cost: 70, durationMinutes: 75, warrantyDays: 180, deviceTypes: ['tablet'], order: 22 },
  { name: 'Battery health check', category: 'battery', price: 0, durationMinutes: 10, deviceTypes: [], order: 23 },

  // ---- charging ----------------------------------------------------------
  { name: 'Charging port repair', category: 'charging_port', price: 99, cost: 32, durationMinutes: 45, warrantyDays: 90, deviceTypes: ['phone', 'tablet'], order: 30 },
  { name: 'Charging port repair (laptop)', category: 'charging_port', price: 149, cost: 60, durationMinutes: 75, warrantyDays: 90, deviceTypes: ['laptop'], order: 31 },
  { name: 'Charging port clean', category: 'charging_port', price: 25, cost: 5, durationMinutes: 15, deviceTypes: ['phone', 'tablet'], order: 32 },

  // ---- camera ------------------------------------------------------------
  { name: 'Rear camera replacement', category: 'camera', price: 119, cost: 52, durationMinutes: 45, warrantyDays: 90, deviceTypes: ['phone'], order: 40 },
  { name: 'Front camera replacement', category: 'camera', price: 99, cost: 40, durationMinutes: 40, warrantyDays: 90, deviceTypes: ['phone'], order: 41 },
  { name: 'Camera lens replacement', category: 'camera', price: 59, cost: 18, durationMinutes: 30, warrantyDays: 90, deviceTypes: ['phone'], order: 42 },

  // ---- audio -------------------------------------------------------------
  { name: 'Speaker replacement', category: 'audio', price: 89, cost: 30, durationMinutes: 40, warrantyDays: 90, deviceTypes: ['phone', 'tablet'], order: 50 },
  { name: 'Earpiece repair', category: 'audio', price: 79, cost: 26, durationMinutes: 40, warrantyDays: 90, deviceTypes: ['phone'], order: 51 },
  { name: 'Microphone repair', category: 'audio', price: 89, cost: 28, durationMinutes: 45, warrantyDays: 90, deviceTypes: ['phone'], order: 52 },

  // ---- water damage ------------------------------------------------------
  // No warranty, deliberately. Corrosion carries on after the device leaves,
  // and a shop that warranties a liquid-damage repair is warrantying a
  // component it has no way to inspect. The zero here is a real answer.
  { name: 'Liquid damage treatment', category: 'water_damage', price: 149, cost: 45, durationMinutes: 120, warrantyDays: 0, deviceTypes: ['phone', 'tablet', 'laptop'], order: 60 },
  { name: 'Board-level repair', category: 'water_damage', price: 249, cost: 90, durationMinutes: 180, warrantyDays: 30, deviceTypes: ['phone', 'laptop'], order: 61 },

  // ---- software ----------------------------------------------------------
  { name: 'Software restore', category: 'software', price: 69, cost: 15, durationMinutes: 60, warrantyDays: 30, deviceTypes: [], order: 70 },
  { name: 'Virus and malware removal', category: 'software', price: 99, cost: 20, durationMinutes: 90, warrantyDays: 30, deviceTypes: ['laptop'], order: 71 },
  { name: 'Operating system install', category: 'software', price: 119, cost: 25, durationMinutes: 120, warrantyDays: 30, deviceTypes: ['laptop'], order: 72 },
  { name: 'Screen protector fitting', category: 'other', price: 15, cost: 6, durationMinutes: 10, deviceTypes: ['phone', 'tablet'], order: 73 },

  // ---- data --------------------------------------------------------------
  // Cost left unrecorded: recovery time varies from twenty minutes to two days
  // and averaging it would put a number on the record that is wrong every time.
  { name: 'Data recovery', category: 'data', price: 199, durationMinutes: 240, deviceTypes: [], order: 80 },
  { name: 'Data transfer', category: 'data', price: 59, cost: 12, durationMinutes: 60, deviceTypes: [], order: 81 },
  { name: 'Backup to customer drive', category: 'data', price: 49, cost: 10, durationMinutes: 45, deviceTypes: [], order: 82 },

  // ---- diagnostic --------------------------------------------------------
  /**
   * Free, and that is the point: it is the line an estimate opens with.
   *
   * A shop quotes work it has not seen by diagnosing first, and charging for
   * the diagnosis makes the customer decide before anybody knows what is wrong.
   * The cost is genuinely unknown for the same reason data recovery's is.
   */
  { name: 'Diagnostic assessment', category: 'diagnostic', price: 0, durationMinutes: 30, deviceTypes: [], order: 90 },
  { name: 'Express diagnostic (same day)', category: 'diagnostic', price: 39, cost: 15, durationMinutes: 30, deviceTypes: [], order: 91 },

  // ---- other -------------------------------------------------------------
  { name: 'Button repair', category: 'other', price: 79, cost: 22, durationMinutes: 40, warrantyDays: 90, deviceTypes: ['phone', 'tablet'], order: 100 },
  { name: 'Housing replacement', category: 'other', price: 159, cost: 68, durationMinutes: 90, warrantyDays: 90, deviceTypes: ['phone'], order: 101 },
  { name: 'Keyboard replacement', category: 'other', price: 189, cost: 95, durationMinutes: 90, warrantyDays: 90, deviceTypes: ['laptop'], order: 102 },
  { name: 'Thermal paste and clean', category: 'other', price: 89, cost: 12, durationMinutes: 60, warrantyDays: 30, deviceTypes: ['laptop', 'console'], order: 103 },
  { name: 'Joystick drift repair', category: 'other', price: 69, cost: 18, durationMinutes: 45, warrantyDays: 90, deviceTypes: ['console'], order: 104 },
  { name: 'HDMI port repair', category: 'other', price: 129, cost: 40, durationMinutes: 90, warrantyDays: 90, deviceTypes: ['console'], order: 105 },
];

export { DEVICE_TREE, SERVICES };
