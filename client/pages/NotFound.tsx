import { logger } from "@/utils/logger";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { MoveLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import MetaHead from "@/components/MetaHead";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { fadeUp } from "@/lib/motion";

const NotFound = () => {
  const location = useLocation();
  const reduced = useReducedMotion();

  useEffect(() => {
    logger.warn(
      "404: non-existent route",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 sm:px-6 lg:px-8">
      <MetaHead title="Página no encontrada" noIndex includeSiteOrganization={false} />
      <motion.div
        className="max-w-lg text-center"
        initial={reduced ? false : "hidden"}
        animate="visible"
        variants={fadeUp}
      >
        <p className="kicker">Error 404</p>
        <h1 className="mt-3 font-display text-display-xl font-bold">Esta página no existe</h1>
        <p className="mx-auto mt-4 max-w-md font-body text-lg text-muted-foreground">
          La ruta{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{location.pathname}</code>{" "}
          no está en INTELINOTA. Quizá se movió o el enlace es incorrecto.
        </p>
        <Button asChild size="lg" className="mt-8 h-11 gap-2 rounded-sm px-6">
          <Link to="/">
            <MoveLeft className="h-4 w-4" />
            Ir a la portada
          </Link>
        </Button>
      </motion.div>
    </div>
  );
};

export default NotFound;
