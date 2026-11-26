import { useEffect, useRef, useState } from "react";
import { useFormik } from "formik";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Bot, Loader2, Mail, RotateCcw, ShieldCheck } from "lucide-react";
import { adminEmailSchema, adminCodeSchema } from "@/lib/validation/schemas";
import MetaHead from "@/components/MetaHead";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { safeAdminReturnPath } from "@shared/mcp";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  requestAdminCode,
  verifyAdminCode,
  clearError,
  resetCodeSent,
  selectAdminAuthLoading,
  selectAdminAuthError,
  selectAdminCodeSent,
  selectAdminCodeSentEmail,
  selectIsAdminAuthenticated,
  selectAdminToken,
  fetchAdminMe,
} from "@/store/slices/adminAuthSlice";
import { cn } from "@/lib/utils";
import { logger } from "@/utils/logger";

const RESEND_SECONDS = 30;
const EMPTY_DIGITS = ["", "", "", "", "", ""];

/** Rotating newsroom lines under the statement — the "subtle animated detail". */
const DESK_LINES = [
  "Escribe. Revisa. Publica.",
  "La portada se arma aquí.",
  "Cada nota, con firma.",
  "Lo que importa, a tiempo.",
];

function OtpBox({
  index,
  value,
  onChange,
  onKeyDown,
  onPaste,
  inputRef,
  invalid,
}: {
  index: number;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  invalid: boolean;
}) {
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      // First box receives the OS one-time-code suggestion (iOS/Android)
      autoComplete={index === 0 ? "one-time-code" : "off"}
      aria-label={`Dígito ${index + 1} de 6`}
      maxLength={index === 0 ? 6 : 1}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onFocus={(e) => e.currentTarget.select()}
      className={cn(
        "h-12 w-full min-w-0 rounded-lg border bg-background text-center font-mono text-xl font-bold tabular-nums outline-none transition-all sm:h-14 sm:text-2xl",
        "focus:border-brand focus:ring-2 focus:ring-brand/25",
        value && "border-foreground/40",
        invalid && "border-destructive",
      )}
    />
  );
}

export default function AdminLogin() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reduced = useReducedMotion();
  // Only allow-listed same-origin paths (MCP consent) — never open redirects
  const afterLogin = safeAdminReturnPath(searchParams.get("return")) ?? "/admin/dashboard";
  const fromMcp = afterLogin !== "/admin/dashboard";

  const loading = useAppSelector(selectAdminAuthLoading);
  const error = useAppSelector(selectAdminAuthError);
  const codeSent = useAppSelector(selectAdminCodeSent);
  const codeSentEmail = useAppSelector(selectAdminCodeSentEmail);
  const isAuthenticated = useAppSelector(selectIsAdminAuthenticated);
  const token = useAppSelector(selectAdminToken);

  const [resendIn, setResendIn] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);

  const emailForm = useFormik({
    initialValues: { email: "" },
    validationSchema: adminEmailSchema,
    onSubmit: (values) => {
      dispatch(requestAdminCode({ email: values.email.trim() }));
    },
  });

  const codeForm = useFormik({
    initialValues: { digits: EMPTY_DIGITS },
    validate: (values) => {
      try {
        adminCodeSchema.validateSync({ code: values.digits.join("") });
        return {};
      } catch (e) {
        return { digits: (e as Error).message };
      }
    },
    onSubmit: (values) => {
      if (!codeSentEmail) return;
      dispatch(verifyAdminCode({ email: codeSentEmail, code: values.digits.join("") }));
    },
  });
  const digits = codeForm.values.digits;
  const setDigits = (next: string[] | ((prev: string[]) => string[])) => {
    const value = typeof next === "function" ? next(codeForm.values.digits) : next;
    void codeForm.setFieldValue("digits", value, false);
  };

  const d0 = useRef<HTMLInputElement>(null);
  const d1 = useRef<HTMLInputElement>(null);
  const d2 = useRef<HTMLInputElement>(null);
  const d3 = useRef<HTMLInputElement>(null);
  const d4 = useRef<HTMLInputElement>(null);
  const d5 = useRef<HTMLInputElement>(null);
  const digitRefs = [d0, d1, d2, d3, d4, d5];

  useEffect(() => {
    if (isAuthenticated) {
      navigate(afterLogin, { replace: true });
      return;
    }
    if (token) {
      dispatch(fetchAdminMe())
        .unwrap()
        .then(() => navigate(afterLogin, { replace: true }))
        .catch((err) => logger.debug("admin login: stored token rejected", err));
    }
  }, [isAuthenticated, token, navigate, dispatch, afterLogin]);

  useEffect(() => {
    if (!codeSent) return;
    setResendIn(RESEND_SECONDS);
    const t = setTimeout(() => digitRefs[0].current?.focus(), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeSent]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setLineIdx((i) => (i + 1) % DESK_LINES.length), 3200);
    return () => clearInterval(t);
  }, [reduced]);

  const code = digits.join("");

  // Auto-submit once all six digits are in (typed, pasted or OS autofill)
  const lastAutoSubmitted = useRef("");
  useEffect(() => {
    if (code.length === 6 && /^\d{6}$/.test(code) && !loading && lastAutoSubmitted.current !== code) {
      lastAutoSubmitted.current = code;
      void codeForm.submitForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, loading]);

  const fillFrom = (idx: number, raw: string) => {
    const chars = raw.replace(/\D/g, "").slice(0, 6 - idx).split("");
    if (!chars.length) return;
    setDigits((d) => d.map((v, i) => (i >= idx && i < idx + chars.length ? chars[i - idx] : v)));
    const focusIdx = Math.min(idx + chars.length, 5);
    setTimeout(() => digitRefs[focusIdx].current?.focus(), 0);
  };

  const handleDigitChange = (idx: number, val: string) => {
    if (error) dispatch(clearError());
    if (!val) {
      setDigits((d) => d.map((v, i) => (i === idx ? "" : v)));
      return;
    }
    if (val.length > 1) {
      fillFrom(idx, val);
      return;
    }
    setDigits((d) => d.map((v, i) => (i === idx ? val : v)));
    if (idx < 5) setTimeout(() => digitRefs[idx + 1].current?.focus(), 0);
  };

  const handleDigitKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      setTimeout(() => digitRefs[idx - 1].current?.focus(), 0);
    } else if (e.key === "ArrowLeft" && idx > 0) {
      digitRefs[idx - 1].current?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      digitRefs[idx + 1].current?.focus();
    }
  };

  const handlePaste = (idx: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    // A full code always replaces from the first box
    fillFrom(pasted.length === 6 ? 0 : idx, pasted);
  };

  const handleBack = () => {
    dispatch(resetCodeSent());
    dispatch(clearError());
    setDigits(EMPTY_DIGITS);
    lastAutoSubmitted.current = "";
  };

  const handleResend = () => {
    if (!codeSentEmail || resendIn > 0 || loading) return;
    setDigits(EMPTY_DIGITS);
    lastAutoSubmitted.current = "";
    dispatch(requestAdminCode({ email: codeSentEmail })).then(() => {
      setResendIn(RESEND_SECONDS);
      digitRefs[0].current?.focus();
    });
  };

  const emailErr = emailForm.touched.email && emailForm.errors.email;
  const fade = reduced
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } };

  return (
    <>
      <MetaHead
        title="Iniciar sesión"
        description="Acceso al panel de administración de Intelinota."
        noIndex
        includeSiteOrganization={false}
      />
      <div className="flex min-h-[100dvh] bg-background text-foreground">
        {/* ── Statement (desktop) ─────────────────────────────── */}
        <aside className="relative hidden w-[52%] flex-col justify-between overflow-hidden border-r bg-muted/40 p-12 lg:flex xl:p-16">
          {/* Ruled paper + one electric rule */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.5] dark:opacity-[0.25]"
            style={{
              backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 39px, hsl(var(--border)) 39px 40px)",
            }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute left-12 top-0 h-full w-px origin-top bg-brand xl:left-16"
            initial={reduced ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />

          <div className="relative pl-6">
            <Logo className="h-8" />
          </div>

          <div className="relative max-w-xl pl-6">
            <p className="kicker">Redacción · Panel editorial</p>
            <motion.h1
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-4 font-display text-5xl font-bold leading-[1.05] tracking-tight xl:text-6xl"
            >
              Las noticias se escriben <span className="text-brand">aquí</span>.
            </motion.h1>
            <div className="mt-6 h-7 overflow-hidden" aria-live="off">
              <AnimatePresence mode="wait">
                <motion.p
                  key={lineIdx}
                  initial={reduced ? false : { y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="font-display text-xl text-muted-foreground"
                >
                  {DESK_LINES[lineIdx]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          <div className="relative flex items-center gap-2 pl-6 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              {!reduced && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </span>
            Acceso sin contraseña · código de un solo uso por correo
          </div>
        </aside>

        {/* ── Form ───────────────────────────────────────────── */}
        <main className="relative flex flex-1 flex-col">
          <div className="flex items-center justify-between px-4 py-4 sm:px-8">
            <div className="lg:invisible">
              <Logo className="h-6" />
            </div>
            <ThemeToggle />
          </div>

          <div className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-8">
            <div className="w-full max-w-sm">
              {fromMcp && (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-brand/30 bg-brand/5 p-3 text-sm">
                  <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <p>Inicia sesión para autorizar la conexión de tu asistente de IA.</p>
                </div>
              )}

              <AnimatePresence mode="wait">
                {!codeSent ? (
                  <motion.div key="email" {...fade} transition={{ duration: 0.25 }}>
                    <p className="kicker">Iniciar sesión</p>
                    <h2 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">Bienvenido de vuelta</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Escribe tu correo de la redacción y te enviaremos un código de 6 dígitos.
                    </p>

                    <form onSubmit={emailForm.handleSubmit} noValidate className="mt-8 space-y-4">
                      <div>
                        <label htmlFor="email" className="mb-1.5 block text-xs font-semibold">Correo electrónico</label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            id="email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            autoFocus
                            placeholder="nombre@intelinota.com"
                            aria-invalid={Boolean(emailErr)}
                            aria-describedby={emailErr ? "email-error" : undefined}
                            className={cn(
                              "h-12 w-full rounded-lg border bg-background pl-10 pr-3 text-base outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20",
                              emailErr && "border-destructive",
                            )}
                            {...emailForm.getFieldProps("email")}
                            onChange={(e) => {
                              if (error) dispatch(clearError());
                              emailForm.handleChange(e);
                            }}
                          />
                        </div>
                        {emailErr && (
                          <p id="email-error" role="alert" className="mt-1.5 text-xs text-destructive">{emailForm.errors.email}</p>
                        )}
                      </div>

                      {error && (
                        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          {error}
                        </p>
                      )}

                      <Button type="submit" className="h-12 w-full text-base" disabled={loading || !emailForm.values.email.trim()}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {loading ? "Enviando…" : "Enviar código"}
                        {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                      </Button>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div key="code" {...fade} transition={{ duration: 0.25 }}>
                    <button
                      type="button"
                      onClick={handleBack}
                      className="-ml-2 mb-4 inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" /> Cambiar correo
                    </button>
                    <p className="kicker">Revisa tu correo</p>
                    <h2 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">Escribe tu código</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Lo enviamos a <strong className="break-all text-foreground">{codeSentEmail}</strong>. Expira en 15 minutos.
                    </p>

                    <form onSubmit={codeForm.handleSubmit} noValidate className="mt-8 space-y-5">
                      <fieldset>
                        <legend className="sr-only">Código de 6 dígitos</legend>
                        <div className="grid grid-cols-6 gap-2 sm:gap-3">
                          {digits.map((d, i) => (
                            <OtpBox
                              key={i}
                              index={i}
                              value={d}
                              inputRef={digitRefs[i]}
                              invalid={Boolean(error)}
                              onChange={(v) => handleDigitChange(i, v)}
                              onKeyDown={(e) => handleDigitKeyDown(i, e)}
                              onPaste={handlePaste(i)}
                            />
                          ))}
                        </div>
                      </fieldset>

                      {error && (
                        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          {error}
                        </p>
                      )}

                      <Button type="submit" className="h-12 w-full text-base" disabled={loading || code.length !== 6}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        {loading ? "Verificando…" : "Entrar al panel"}
                      </Button>

                      <div className="text-center">
                        <button
                          type="button"
                          onClick={handleResend}
                          disabled={resendIn > 0 || loading}
                          className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {resendIn > 0 ? `Reenviar código en ${resendIn}s` : "Reenviar código"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="mt-10 text-center text-xs text-muted-foreground">
                ¿Sin acceso? Pide a un administrador que te invite desde <span className="font-medium">Equipo</span>.
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
