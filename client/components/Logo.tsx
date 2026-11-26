import { SITE_LOGO, SITE_LOGO_DARK_INK } from "@/lib/branding";
import { cn } from "@/lib/utils";

/** Theme-aware wordmark: dark ink on paper, white on charcoal. */
export default function Logo({ className }: { className?: string }) {
  return (
    <>
      <img
        src={SITE_LOGO_DARK_INK}
        alt="INTELINOTA"
        width={800}
        height={130}
        data-no-dim
        className={cn("w-auto object-contain dark:hidden", className)}
      />
      <img
        src={SITE_LOGO}
        alt=""
        aria-hidden="true"
        width={800}
        height={130}
        data-no-dim
        className={cn("hidden w-auto object-contain dark:block", className)}
      />
    </>
  );
}
