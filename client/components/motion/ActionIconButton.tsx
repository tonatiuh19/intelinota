import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface ActionIconButtonProps {
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void | Promise<void>;
  className?: string;
  successDuration?: number;
  showFeedback?: boolean;
}

export default function ActionIconButton({
  icon,
  activeIcon,
  label,
  active,
  onClick,
  className,
  successDuration = 1200,
  showFeedback = true,
}: ActionIconButtonProps) {
  const reduced = useReducedMotion();
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(false), successDuration);
    return () => clearTimeout(t);
  }, [success, successDuration]);

  async function handleClick() {
    await onClick();
    if (showFeedback) setSuccess(true);
  }

  return (
    <motion.div
      whileTap={reduced ? undefined : { scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "rounded-full hover:bg-primary/10 hover:text-primary h-8 w-8 relative overflow-hidden",
          active && "text-primary",
          className,
        )}
        onClick={handleClick}
        aria-label={label}
      >
        <motion.span
          key={success ? "success" : active ? "active" : "default"}
          initial={reduced ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="inline-flex"
        >
          {success ? (
            <Check className="h-3.5 w-3.5" />
          ) : active && activeIcon ? (
            activeIcon
          ) : (
            icon
          )}
        </motion.span>
      </Button>
    </motion.div>
  );
}
