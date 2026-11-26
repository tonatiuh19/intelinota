import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Check, Copy, Loader2, Plug, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { logger } from "@/utils/logger";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchMcpConnections,
  revokeMcpConnection,
  selectAdminMcp,
} from "@/store/slices/adminMcpSlice";

const FALLBACK_URL = "https://www.intelinota.com/api/mcp";

function ago(iso: string | null): string {
  if (!iso) return "nunca";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
  } catch {
    return iso;
  }
}

export default function McpConnectionsCard() {
  const dispatch = useAppDispatch();
  const { connectorUrl, connections, connectionsLoading, connectionsError, revokingId } =
    useAppSelector(selectAdminMcp);
  const [copied, setCopied] = useState<string | null>(null);
  const url = connectorUrl ?? FALLBACK_URL;
  const cursorJson = JSON.stringify({ mcpServers: { intelinota: { url } } }, null, 2);

  useEffect(() => {
    dispatch(fetchMcpConnections());
  }, [dispatch]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch (err) {
      logger.warn("clipboard copy failed", err);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold">Conexiones de IA (MCP)</h2>
          <p className="text-sm text-muted-foreground">
            Conecta Claude o Cursor a la redacción. Trabajan con tus mismos permisos y cada escritura pide
            confirmación.
          </p>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">URL del conector</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <code className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm">
            {url}
          </code>
          <Button type="button" variant="outline" className="h-10 gap-2" onClick={() => copy("url", url)}>
            {copied === "url" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied === "url" ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h3 className="mb-2 text-sm font-semibold">Claude (web, escritorio o móvil)</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Abre Configuración → <strong>Customize → Connectors</strong>.</li>
            <li>Elige <strong>Add custom connector</strong> y pega la URL.</li>
            <li>Pulsa <strong>Connect</strong>, inicia sesión con tu correo y autoriza.</li>
          </ol>
        </div>
        <div className="rounded-lg border border-border p-4 min-w-0">
          <h3 className="mb-2 text-sm font-semibold">Cursor</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            Agrega a <code>.cursor/mcp.json</code> y pulsa «Needs login»:
          </p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 pr-12 text-xs">{cursorJson}</pre>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1 h-10 w-10"
              aria-label="Copiar configuración de Cursor"
              onClick={() => copy("cursor", cursorJson)}
            >
              {copied === "cursor" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Plug className="h-4 w-4 text-brand" /> Mis conexiones activas
        </h3>
        {connectionsError && (
          <Alert variant="destructive" className="mb-3">
            <AlertDescription>{connectionsError}</AlertDescription>
          </Alert>
        )}
        {connectionsLoading && !connections.length ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          </div>
        ) : connections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Aún no conectas ningún cliente de IA.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            <AnimatePresence initial={false}>
              {connections.map((c) => (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{c.client_name}</span>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {c.scopes}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Conectado {ago(c.created_at)} · último uso {ago(c.last_used_at)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 gap-2 text-destructive hover:text-destructive"
                    disabled={revokingId === c.id}
                    onClick={() => dispatch(revokeMcpConnection(c.id))}
                  >
                    {revokingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Revocar
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}
