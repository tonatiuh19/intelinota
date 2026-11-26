import { useId } from "react";
import { useFormik } from "formik";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { subscribeNewsletter } from "@/store/slices/newsletterSlice";
import { newsletterSchema } from "@/lib/validation/schemas";

interface NewsletterFormProps {
  variant?: "footer" | "sidebar" | "inline";
  source?: string;
  className?: string;
}

export default function NewsletterForm({
  variant = "footer",
  source = "website",
  className,
}: NewsletterFormProps) {
  const dispatch = useAppDispatch();
  const { status, message, source: activeSource } = useAppSelector((s) => s.newsletter);
  const inputId = useId();
  const { toast } = useToast();
  const mine = activeSource === source;
  const submitting = mine && status === "submitting";
  const subscribed = mine && status === "succeeded";
  const successMessage = message ?? "";

  const formik = useFormik({
    initialValues: { email: "", website: "" },
    validationSchema: newsletterSchema,
    onSubmit: async (values, helpers) => {
      const result = await dispatch(
        subscribeNewsletter({
          email: values.email.trim(),
          website: values.website,
          source,
        }),
      );
      if (subscribeNewsletter.rejected.match(result)) {
        toast({
          title: "No se pudo suscribir",
          description: String(result.payload ?? ""),
          variant: "destructive",
        });
      } else {
        helpers.resetForm();
      }
    },
  });

  const onDark = variant === "sidebar" || variant === "inline";

  return (
    <AnimatePresence mode="wait">
      {subscribed ? (
        <motion.div
          key="success"
          role="status"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("flex items-start gap-3", className)}
        >
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              onDark ? "bg-background/15" : "bg-brand/10",
            )}
          >
            <Check className={cn("h-5 w-5", onDark ? "text-background" : "text-brand")} />
          </span>
          <span>
            <span className="block font-semibold">¡Casi listo!</span>
            <span className={cn("text-sm", onDark ? "opacity-80" : "text-muted-foreground")}>
              {successMessage} Confirma desde el enlace que te enviamos.
            </span>
          </span>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={formik.handleSubmit}
          noValidate
          className={cn("relative", className)}
          exit={{ opacity: 0 }}
        >
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
            value={formik.values.website}
            onChange={formik.handleChange}
          />
          <label htmlFor={inputId} className="sr-only">
            Correo electrónico
          </label>
          <div className={cn("flex gap-2", onDark ? "flex-col" : "flex-col sm:flex-row")}>
            <input
              id={inputId}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              aria-invalid={Boolean(formik.touched.email && formik.errors.email)}
              aria-describedby={formik.errors.email ? `${inputId}-err` : undefined}
              value={formik.values.email}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="tu@correo.com"
              disabled={submitting}
              className={cn(
                "h-11 w-full min-w-0 flex-1 rounded-sm border px-4 text-sm outline-none transition-colors",
                onDark
                  ? "border-background/25 bg-background/10 text-background placeholder:text-background/50 focus:border-background"
                  : "border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-foreground",
              )}
            />
            <Button
              type="submit"
              disabled={submitting}
              className={cn(
                "h-11 shrink-0 rounded-sm px-6 font-semibold",
                onDark
                  ? "bg-brand text-brand-foreground hover:bg-brand/90"
                  : "bg-foreground text-background hover:bg-foreground/90",
              )}
            >
              {submitting ? "Enviando…" : "Suscribirme"}
            </Button>
          </div>
          {formik.touched.email && formik.errors.email && (
            <p id={`${inputId}-err`} role="alert" className="mt-1.5 text-xs text-brand">
              {formik.errors.email}
            </p>
          )}
        </motion.form>
      )}
    </AnimatePresence>
  );
}
