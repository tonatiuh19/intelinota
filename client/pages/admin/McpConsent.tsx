import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  Loader2,
  Lock,
  PenSquare,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import MetaHead from "@/components/MetaHead";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SITE_LOGO, SITE_LOGO_DARK_INK } from "@/lib/branding";
import { logger } from "@/utils/logger";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAdminMe,
  selectAdminToken,
  selectAdminUser,
} from "@/store/slices/adminAuthSlice";
import {
  decideMcpConsent,
  fetchMcpConsentInfo,
  selectAdminMcp,
} from "@/store/slices/adminMcpSlice";
import type { McpRights } from "@shared/api";

function rightsList(r: McpRights): { ok: boolean; label: string }[] {
  return [
    { ok: true, label: r.sees_articles === "all" ? "Leer todos los artículos del panel" : "Leer tus propios artículos" },
    { ok: true, label: "Crear borradores y editar tus notas" },
    {
      ok: r.can_publish,
      label: r.can_publish
        ? "Publicar, programar y archivar"
        : "Publicar (no: tus cambios a notas publicadas quedan pendientes de revisión)",
    },
    { ok: r.can_approve_reviews, label: "Aprobar o devolver artículos en revisión" },
    {
      ok: true,
      label: r.can_moderate_comments === "all" ? "Moderar todos los comentarios" : "Moderar comentarios de tus notas",
    },
    { ok: r.can_feature, label: "Destacar notas en portada" },
  ];
}

export default function McpConsent() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const token = useAppSelector(selectAdminToken);
  const user = useAppSelector(selectAdminUser);
  const { consent, consentLoading, consentError, deciding } = useAppSelector(selectAdminMcp);

  const request = useMemo(
    () => ({
      client_id: params.get("client_id") ?? "",
      redirect_uri: params.get("redirect_uri") ?? "",
      code_challenge: params.get("code_challenge") ?? "",
      state: params.get("state") ?? "",
      scope: params.get("scope") ?? "",
    }),
    [params],
  );
  const valid = Boolean(request.client_id && request.redirect_uri && request.code_challenge);

  // Not signed in → email-OTP login, then back here (allow-listed ?return=)
  useEffect(() => {
    const back = `/admin/login?return=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
    if (!token) {
      navigate(back, { replace: true });
      return;
    }
    if (!user) {
      dispatch(fetchAdminMe())
        .unwrap()
        .catch(() => navigate(back, { replace: true }));
    }
  }, [token, user, dispatch, navigate, location.pathname, location.search]);

  useEffect(() => {
    if (user && valid) {
      dispatch(fetchMcpConsentInfo({ client_id: request.client_id, redirect_uri: request.redirect_uri }));
    }
  }, [user, valid, request.client_id, request.redirect_uri, dispatch]);

  const decide = async (approve: boolean) => {
    try {
      const redirectTo = await dispatch(decideMcpConsent({ ...request, approve })).unwrap();
      window.location.assign(redirectTo);
    } catch (err) {
      logger.warn("mcp consent decision failed", err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10 sm:px-6">
      <MetaHead title="Autorizar conexión de IA" noIndex />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-lg"
      >
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src={SITE_LOGO_DARK_INK} alt="Intelinota" className="h-8 w-auto dark:hidden" />
          <img src={SITE_LOGO} alt="Intelinota" className="hidden h-8 w-auto dark:block" />
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-xl shadow-brand/5 overflow-hidden">
          <div className="bg-brand/10 border-b border-border px-5 py-5 sm:px-7">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-xl font-bold leading-tight sm:text-2xl">
                  {consent ? `${consent.client_name} quiere acceder a tu redacción` : "Autorizar conexión de IA"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Conexión MCP a Intelinota con <strong>tus mismos permisos</strong>, ni más ni menos.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-5 py-6 sm:px-7">
            {!valid && (
              <Alert variant="destructive">
                <AlertDescription>Solicitud incompleta. Vuelve a iniciar la conexión desde tu cliente de IA.</AlertDescription>
              </Alert>
            )}

            {valid && (consentLoading || !user) && (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            )}

            {consentError && (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                  {consentError}
                </AlertDescription>
              </Alert>
            )}

            {consent && (
              <>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-3">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cuenta</dt>
                    <dd className="mt-1 break-all font-medium">{consent.user.name ?? consent.user.email}</dd>
                    <dd className="mt-1">
                      <Badge variant="secondary" className="capitalize">
                        {consent.user.role === "admin" ? "Administrador" : "Autor"}
                      </Badge>
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Permiso solicitado</dt>
                    <dd className="mt-1 font-mono text-xs break-all">{consent.scope}</dd>
                    <dd className="mt-1 text-xs text-muted-foreground break-all">Regresa a: {consent.redirect_host}</dd>
                  </div>
                </dl>

                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <PenSquare className="h-4 w-4 text-brand" /> Podrá, en tu nombre:
                  </h2>
                  <ul className="space-y-2">
                    {rightsList(consent.rights).map((r) => (
                      <li key={r.label} className="flex items-start gap-2 text-sm">
                        {r.ok ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        )}
                        <span className={r.ok ? "" : "text-muted-foreground"}>{r.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  Toda escritura pide confirmación explícita y queda registrada. Puedes revocar esta conexión cuando
                  quieras en Perfil → Conexiones de IA.
                </p>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="h-11 sm:h-10"
                    disabled={deciding}
                    onClick={() => decide(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="h-11 sm:h-10 bg-brand text-brand-foreground hover:bg-brand/90 gap-2"
                    disabled={deciding}
                    onClick={() => decide(true)}
                  >
                    {deciding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Autorizar
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
