/**
 * The motion vocabulary. Every transition in the app comes from here.
 *
 * Before this existed, each component picked its own duration and curve at the
 * call site — twelve different durations across the client, several of them
 * within 20ms of each other, and an entrance curve too weak to read as
 * deliberate. Motion that varies at random between components is exactly what
 * makes an interface feel machine-assembled: the eye cannot learn the system,
 * so nothing feels intentional.
 *
 * Three rules encoded below, and they are not stylistic preferences:
 *
 * 1. EXITS ARE FASTER THAN ENTRANCES. The user decides when to open something;
 *    the system responds when they close it. Responding should always outpace
 *    deciding, so an exit runs at roughly half the entrance duration.
 *
 * 2. NEVER `ease-in` ON A UI ELEMENT. A curve that starts slow delays movement
 *    at the exact moment the user is watching most closely, so it reads as lag
 *    even at an identical duration. Everything arriving or leaving uses
 *    `entrance`, which front-loads the motion.
 *
 * 3. NOTHING ENTERS FROM `scale(0)`. Nothing in the physical world appears out
 *    of nothing. Entrances start at 0.96–0.98 so the element already has a
 *    shape before it grows into place.
 *
 * The CSS side of the same vocabulary lives in styles/index.css as
 * --ease-* and --duration-* tokens; the values are kept in sync by hand,
 * which is why both files carry the same names.
 */

/* --- easing curves -------------------------------------------------------
   The built-in CSS easings are too weak to register as a decision. These are
   the stronger variants, as arrays because that is what Motion expects. */
export const ease = {
  /** Anything arriving or leaving. Starts fast. */
  entrance: [0.23, 1, 0.32, 1],
  /** Exits only, where a slight acceleration out is wanted. */
  exit: [0.4, 0, 1, 1],
  /** Something already on screen that moves or morphs. */
  standard: [0.77, 0, 0.175, 1],
  /** The iOS drawer curve, for edge-anchored sheets. */
  sheet: [0.32, 0.72, 0, 1],
};

/* --- durations, in seconds (Motion's unit) -------------------------------
   Named for what is moving, never for how long it takes, so a call site
   cannot quietly drift to a bespoke value. Nothing exceeds 300ms: past that
   the interface feels like it is thinking rather than responding. */
export const duration = {
  press: 0.14,
  fast: 0.16,
  snap: 0.2,
  panel: 0.26,
  exit: 0.14,
};

/* --- springs -------------------------------------------------------------
   Apple's parameterisation (duration + bounce) rather than raw mass/stiffness
   /damping, because it can actually be reasoned about: `bounce` is how much
   overshoot you get, `duration` is roughly how long until it settles.

   Springs matter for anything interruptible. A spring that is reversed
   mid-flight keeps its velocity and turns around smoothly; a duration-based
   tween restarts from zero and visibly stutters. Use these wherever the user
   can change their mind mid-animation — dragging, rapid toggling, a menu
   dismissed while it is still opening. */
export const spring = {
  /** Default for interruptible UI. No overshoot — this is a work app. */
  snappy: { type: 'spring', duration: 0.35, bounce: 0 },
  /** Panels and sheets. A trace of bounce so they feel physical, not driven. */
  panel: { type: 'spring', duration: 0.45, bounce: 0.12 },
  /** Drag release and playful affordances only. Never on data. */
  playful: { type: 'spring', duration: 0.5, bounce: 0.28 },
};

/* --- transition presets --------------------------------------------------
   Ready to spread into a Motion component's `transition`. */
export const transition = {
  press: { duration: duration.press, ease: ease.entrance },
  fast: { duration: duration.fast, ease: ease.entrance },
  snap: { duration: duration.snap, ease: ease.entrance },
  panel: { duration: duration.panel, ease: ease.entrance },
  exit: { duration: duration.exit, ease: ease.exit },
};

/* --- variants ------------------------------------------------------------
   The handful of entrances the app actually uses. Each pairs an entrance with
   a faster exit, per rule 1.

   Every one of these starts from a visible scale and a small offset. The
   offsets are small on purpose: a popover that travels 20px reads as a slide,
   which implies the content came from somewhere else on screen. 4–8px reads as
   the element settling into place, which is what actually happened. */

/** Menus, dropdowns, selects, popovers. Pair with `originClass` so it scales
 *  from its trigger rather than from its own centre. */
export const popover = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: transition.snap },
  exit: { opacity: 0, scale: 0.98, y: -2, transition: transition.exit },
};

/** Centred dialogs. Modals keep a centre origin — unlike a popover they are
 *  not anchored to a trigger, so scaling from one would be a lie. */
export const dialog = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: spring.panel },
  exit: { opacity: 0, scale: 0.99, y: 4, transition: transition.exit },
};

/** The scrim behind any overlay. Opacity only — a blurred backdrop that also
 *  moves is two effects competing for the same moment. */
export const scrim = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transition.snap },
  exit: { opacity: 0, transition: transition.exit },
};

/** Tooltips. Faster than a popover and travelling less, because they are
 *  incidental — the user is already looking at the trigger. */
export const tooltip = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: transition.fast },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.1 } },
};

/** Toasts. Enter from below, exit the same way, so swipe-to-dismiss matches
 *  the direction the toast arrived from. */
export const toast = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: spring.panel },
  exit: { opacity: 0, y: 8, scale: 0.98, transition: transition.exit },
};

/** Edge-anchored sheets. Percentage translation so the value is independent of
 *  the panel's measured size. */
export const sheet = {
  left: {
    initial: { x: '-100%' },
    animate: { x: 0, transition: { duration: 0.3, ease: ease.sheet } },
    exit: { x: '-100%', transition: { duration: 0.22, ease: ease.sheet } },
  },
  right: {
    initial: { x: '100%' },
    animate: { x: 0, transition: { duration: 0.3, ease: ease.sheet } },
    exit: { x: '100%', transition: { duration: 0.22, ease: ease.sheet } },
  },
  bottom: {
    initial: { y: '100%' },
    animate: { y: 0, transition: { duration: 0.3, ease: ease.sheet } },
    exit: { y: '100%', transition: { duration: 0.22, ease: ease.sheet } },
  },
};

/** Row/card entrance for a list that has just loaded. Used with `stagger`. */
export const listItem = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: transition.snap },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/**
 * Stagger container. Keep the step short — 30–60ms. Long staggers turn a list
 * of twenty rows into a two-second wait, and stagger is decoration: it must
 * never gate interaction.
 *
 * `delayChildren` stays at 0. A stagger that also waits before starting reads
 * as the page being slow rather than the rows being sequenced.
 */
export function staggerContainer(step = 0.04) {
  return {
    initial: {},
    animate: { transition: { staggerChildren: step, delayChildren: 0 } },
    exit: {},
  };
}

/**
 * Tailwind classes that make an element scale from its trigger instead of from
 * its own centre. Pick by the side the popover opens on.
 *
 * Whether anyone consciously notices a menu growing from the button that
 * opened it is not the point — in aggregate, details like this are the
 * difference between an interface that feels considered and one that does not.
 */
export const originClass = {
  'bottom-start': 'origin-top-left',
  'bottom-end': 'origin-top-right',
  bottom: 'origin-top',
  'top-start': 'origin-bottom-left',
  'top-end': 'origin-bottom-right',
  top: 'origin-bottom',
  left: 'origin-right',
  right: 'origin-left',
};

/**
 * Press feedback. Every pressable element in the app carries this — it is the
 * single cheapest thing that makes a UI feel like it is listening.
 *
 * Kept as a class string rather than a Motion prop because it must work on
 * plain buttons, links and table rows without wrapping each one in a
 * motion component. The hover half is gated behind a pointer query: touch
 * devices fire hover on tap, so an ungated hover state sticks after the finger
 * lifts and the element stays lit until something else is touched.
 */
export const pressable =
  'transition-[transform,background-color,border-color,color,box-shadow,filter] duration-press ease-entrance ' +
  'active:scale-[0.97] motion-reduce:active:scale-100 motion-reduce:transition-none';

/** The same, softened, for a large surface — a card or a table row. Scaling a
 *  full-width row by 3% is a visible lurch; 0.5% is a nudge. */
export const pressableSurface =
  'transition-[transform,background-color,border-color,box-shadow] duration-press ease-entrance ' +
  'active:scale-[0.995] motion-reduce:active:scale-100 motion-reduce:transition-none';
