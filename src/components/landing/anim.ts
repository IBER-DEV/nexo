import type { Variants } from "framer-motion";

/** Ultra-responsive ease used across the whole experience. */
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Standard enter animation: smooth fade-up. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: EASE, delay: i * 0.08 },
  }),
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};
