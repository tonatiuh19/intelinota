import { StaticPageLayout } from "@/components/StaticPageLayout";
import { Mail } from "lucide-react";

export default function Contact() {
  return (
    <StaticPageLayout
      title="Contáctanos"
      description="Ponte en contacto con el equipo de Intelinota."
      path="/contact"
    >
      <p>
        ¿Tienes una sugerencia, colaboración o consulta editorial? Nos encantaría
        escucharte.
      </p>
      <div className="border-y-2 border-rule py-5 font-sans">
        <div className="flex items-center gap-3 text-foreground">
          <Mail className="h-5 w-5 shrink-0 text-brand" />
          <div>
            <p className="kicker !text-muted-foreground">Correo general</p>
            <a
              href="mailto:contacto@intelinota.com"
              className="font-display text-xl font-semibold"
            >
              contacto@intelinota.com
            </a>
          </div>
        </div>
      </div>
      <p>
        Para prensa y colaboraciones:{" "}
        <a href="mailto:prensa@intelinota.com">
          prensa@intelinota.com
        </a>
      </p>
      <p className="!text-sm text-muted-foreground">
        Respondemos en un plazo de 2 a 3 días hábiles.
      </p>
    </StaticPageLayout>
  );
}
