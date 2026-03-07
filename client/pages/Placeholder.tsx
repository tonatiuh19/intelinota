import { Link } from "react-router-dom";
import { MoveLeft, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Placeholder({ title }: { title?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <Construction className="h-20 w-20 text-muted-foreground mb-8" />
      <h1 className="text-4xl font-black italic tracking-tighter mb-4 uppercase">
        {title || "Próximamente"}
      </h1>
      <p className="text-muted-foreground text-lg max-w-md mb-12">
        Estamos construyendo la sección {title ? `"${title}"` : "esta"} de Intelinota para ofrecerte la mejor experiencia de revista inteligente.
      </p>
      <Link to="/">
        <Button size="lg" className="rounded-full px-8 flex items-center gap-2 group">
          <MoveLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Volver al Inicio
        </Button>
      </Link>
    </div>
  );
}
