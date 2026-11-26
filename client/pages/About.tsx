import { StaticPageLayout } from "@/components/StaticPageLayout";

export default function About() {
  return (
    <StaticPageLayout
      title="Nuestra Historia"
      description="Conoce la historia y misión de Intelinota, la revista digital inteligente."
      path="/about"
    >
      <p>
        Intelinota nació con una idea simple: hacer que las noticias sean más
        claras, más rápidas y más relevantes para lectores modernos. Combinamos
        periodismo riguroso con una experiencia digital pensada para quienes
        consumen información en movimiento.
      </p>
      <p>
        Cubrimos tecnología, deportes, videojuegos, cine y noticias globales con
        un enfoque editorial independiente. Cada historia está escrita para
        informar, contextualizar y conectar con nuestra comunidad de lectores
        curiosos.
      </p>
      <p>
        Nuestro equipo editorial trabaja cada día para ofrecer análisis
        profundos, cobertura en tiempo real y contenido enriquecido con
        multimedia, siempre con la calidad como prioridad.
      </p>
    </StaticPageLayout>
  );
}
