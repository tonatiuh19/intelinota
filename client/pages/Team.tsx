import { Link } from "react-router-dom";
import { StaticPageLayout } from "@/components/StaticPageLayout";

export default function Team() {
  return (
    <StaticPageLayout
      title="El Equipo"
      description="Conoce al equipo editorial detrás de Intelinota."
      path="/team"
    >
      <p>
        Intelinota está impulsado por un equipo multidisciplinario de
        periodistas, editores, diseñadores y desarrolladores apasionados por
        contar historias que importan.
      </p>
      <p>
        Cada sección — Tecnología, Deportes, Videojuegos, Cine y Mundo — cuenta
        con autores especializados que aportan perspectiva, experiencia y voz
        propia a cada artículo publicado.
      </p>
      <p>
        ¿Quieres conocer a nuestros autores? Visita la{" "}
        <Link to="/autores">
          página de autores
        </Link>{" "}
        o escríbenos desde contacto.
      </p>
    </StaticPageLayout>
  );
}
