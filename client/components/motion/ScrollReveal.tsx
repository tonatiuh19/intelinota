import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { defaultTransition, fadeUp } from "@/lib/motion";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  once?: boolean;
}

export default function ScrollReveal({
  children,
  className,
  once = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "-8% 0px" });
  const reduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={reduced ? false : "hidden"}
      animate={inView || reduced ? "visible" : "hidden"}
      variants={fadeUp}
      transition={reduced ? { duration: 0 } : defaultTransition}
    >
      {children}
    </motion.div>
  );
}
