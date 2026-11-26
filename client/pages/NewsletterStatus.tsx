import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, MailX, AlertTriangle, Mail } from "lucide-react";
import MetaHead from "@/components/MetaHead";
import NewsletterForm from "@/components/NewsletterForm";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { unsubscribeNewsletter } from "@/store/slices/newsletterSlice";

const STATES = {
  confirmed: {
    icon: CheckCircle2,
    title: "¡Suscripción confirmada!",
    body: "Desde mañana recibirás lo esencial del día en tu correo.",
  },
  unsubscribed: {
    icon: MailX,
    title: "Te has dado de baja",
    body: "Ya no recibirás nuestro boletín. Puedes volver cuando quieras.",
  },
  invalid: {
    icon: AlertTriangle,
    title: "Enlace inválido o caducado",
    body: "Vuelve a suscribirte para recibir un nuevo enlace de confirmación.",
  },
  error: {
    icon: AlertTriangle,
    title: "Algo salió mal",
    body: "No pudimos procesar tu solicitud. Inténtalo de nuevo en unos minutos.",
  },
} as const;

export default function NewsletterStatus() {
  const [params] = useSearchParams();
  const dispatch = useAppDispatch();
  const nl = useAppSelector((s) => s.newsletter);
  const unsubscribeToken = params.get("unsubscribe");

  if (unsubscribeToken) {
    const done = nl.source === "unsubscribe" && nl.status === "succeeded";
    const busy = nl.source === "unsubscribe" && nl.status === "submitting";
    return (
      <div className="container px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <MetaHead title="Darse de baja" description="Boletín de INTELINOTA." noIndex />
        <div className="mx-auto max-w-lg text-center">
          {done ? <MailX className="mx-auto h-12 w-12 text-brand" strokeWidth={1.5} /> : <Mail className="mx-auto h-12 w-12 text-brand" strokeWidth={1.5} />}
          <h1 className="mt-6 font-display text-display-lg font-bold">
            {done ? STATES.unsubscribed.title : "¿Darte de baja del boletín?"}
          </h1>
          <p className="mt-3 font-body text-lg text-muted-foreground">
            {done ? STATES.unsubscribed.body : "Dejarás de recibir nuestro resumen diario."}
          </p>
          {nl.source === "unsubscribe" && nl.error && (
            <p role="alert" className="mt-4 text-sm text-brand">{nl.error}</p>
          )}
          {!done && (
            <Button
              className="mt-8 h-11"
              disabled={busy}
              onClick={() => dispatch(unsubscribeNewsletter(unsubscribeToken))}
            >
              {busy ? "Procesando…" : "Sí, darme de baja"}
            </Button>
          )}
          <div>
            <Button asChild variant="outline" className="mt-4 h-11">
              <Link to="/">Ir a la portada</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const key = params.get("status") as keyof typeof STATES | null;
  const state = key && key in STATES ? STATES[key] : null;
  const Icon = state?.icon ?? Mail;

  return (
    <div className="container px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <MetaHead title="Boletín" description="Boletín diario de INTELINOTA." noIndex />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-lg text-center"
      >
        <Icon className="mx-auto h-12 w-12 text-brand" strokeWidth={1.5} />
        <h1 className="mt-6 font-display text-display-lg font-bold">
          {state?.title ?? "El boletín de INTELINOTA"}
        </h1>
        <p className="mt-3 font-body text-lg text-muted-foreground">
          {state?.body ?? "Lo esencial del día, cada mañana. Gratis."}
        </p>
        {key !== "confirmed" && (
          <NewsletterForm variant="footer" source="newsletter_page" className="mx-auto mt-8 max-w-md text-left" />
        )}
        <Button asChild variant="outline" className="mt-8 h-11">
          <Link to="/">Ir a la portada</Link>
        </Button>
      </motion.div>
    </div>
  );
}
