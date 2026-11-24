import React from 'react';
import { motion } from 'framer-motion';

/**
 * ScrollReveal Component
 * Smooth scroll-reveal wrapper that animates cleanly into view once when scrolled into viewport.
 * 
 * Props:
 * - children: ReactNode
 * - delay: number (in seconds, e.g. 0.05, 0.1, 0.15 for cascading items)
 * - className: string
 * - yOffset: number (optional override, defaults to 24)
 * - duration: number (optional override, defaults to 0.45)
 */
export default function ScrollReveal({
  children,
  delay = 0,
  className = '',
  yOffset = 24,
  duration = 0.45,
  ...rest
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration,
        ease: 'easeOut',
        delay
      }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
