import type { Transition, Variants } from "motion/react";

/* One animation voice for the whole site. Import these instead of writing
   ad-hoc transitions so reveals, pulses, and hovers all feel related. */

/** Default UI spring — snappy but damped, no wobble. */
export const spring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
};

/** Softer spring for meters/gauges interpolating between 10Hz snapshots. */
export const meterSpring: Transition = {
  type: "spring",
  stiffness: 120,
  damping: 24,
};

/** Section / card entrance: rise + fade. Use with whileInView or animate. */
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

/** Parent container that staggers `fadeRise` children. */
export const staggerChildren: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

/** Checkpoint-complete pulse (progress dots, quiz correct). */
export const pulse: Variants = {
  idle: { scale: 1 },
  pulse: { scale: [1, 1.25, 1], transition: { duration: 0.45 } },
};
