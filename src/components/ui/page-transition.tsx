"use client";

import { motion } from "framer-motion";

const pageVariants = {
  hidden: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0 },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="enter"
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
