import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { fadeUp, staggerContainer } from "@/lib/motion";

interface StaggerGridProps {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "ul";
}

export default function StaggerGrid({
  className,
  children,
  as = "div",
}: StaggerGridProps) {
  const reduced = useReducedMotion();
  const Comp = motion[as];

  return (
    <Comp
      className={cn(className)}
      initial={reduced ? false : "hidden"}
      animate="visible"
      variants={staggerContainer}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({
  className,
  children,
  as = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "li";
}) {
  const reduced = useReducedMotion();
  const Comp = motion[as];

  return (
    <Comp
      className={cn(className)}
      variants={reduced ? undefined : fadeUp}
    >
      {children}
    </Comp>
  );
}
