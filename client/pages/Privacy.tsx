import { StaticPageLayout } from "@/components/StaticPageLayout";

export default function Privacy() {
  return (
    <StaticPageLayout
      title="Política de Privacidad"
      description="Política de privacidad y tratamiento de datos de Intelinota."
      path="/privacy"
    >
      <p>
        En Intelinota respetamos tu privacidad. Esta política describe qué
        información recopilamos y cómo la utilizamos cuando visitas nuestro sitio.
      </p>
      <h2>
        Información que recopilamos
      </h2>
      <p>
        Recopilamos datos de navegación anónimos (como páginas visitadas y
        dispositivo) para mejorar la experiencia y medir el rendimiento editorial.
        Si te suscribes a nuestro newsletter, almacenamos tu correo únicamente
        para enviarte comunicaciones relacionadas con Intelinota.
      </p>
      <h2>
        Uso de cookies
      </h2>
      <p>
        Utilizamos cookies esenciales para el funcionamiento del sitio y cookies
        analíticas (como Plausible o Google Analytics) para entender cómo
        interactúan los lectores con nuestro contenido. Puedes gestionar las
        cookies desde la configuración de tu navegador o activar «Do Not Track».
      </p>
      <h2>
        Tus derechos
      </h2>
      <p>
        Puedes solicitar acceso, corrección o eliminación de tus datos personales
        escribiendo a{" "}
        <a
          href="mailto:privacidad@intelinota.com"
         
        >
          privacidad@intelinota.com
        </a>
        .
      </p>
      <p className="!text-sm text-muted-foreground">
        Última actualización: junio 2026.
      </p>
    </StaticPageLayout>
  );
}
