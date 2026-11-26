import { useEffect, useRef } from "react";
import { useFormik } from "formik";
import { adminEmailSchema, adminCodeSchema } from "@/lib/validation/schemas";
import { SITE_LOGO } from "@/lib/branding";
import MetaHead from "@/components/MetaHead";
import { useNavigate, useSearchParams } from "react-router-dom";
import { safeAdminReturnPath } from "@shared/mcp";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper,
  Mail,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  BarChart3,
  PenSquare,
  Users,
  Loader2,
  Sparkles,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Animated background orb ───────────────────────────────────
function Orb({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      className={cn(
        "absolute rounded-full blur-[90px] pointer-events-none",
        className,
      )}
      animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0.65, 0.35] }}
      transition={{ duration: 7, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ── Floating particle ─────────────────────────────────────────
function Particle({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <motion.div
      className="absolute w-[3px] h-[3px] rounded-full bg-blue-400/40"
      style={{ left: `${x}%`, top: `${y}%` }}
      animate={{ y: [0, -28, 0], opacity: [0, 0.7, 0] }}
      transition={{
        duration: 4 + (delay % 3),
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

// ── Feature row ───────────────────────────────────────────────
function FeatureItem({
  icon: Icon,
  label,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  delay: number;
}) {
  return (
    <motion.li
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <motion.div
        className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0"
        whileHover={{ scale: 1.12, backgroundColor: "rgba(59,130,246,0.2)" }}
      >
        <Icon className="w-4 h-4 text-blue-400" />
      </motion.div>
      <span className="text-sm text-blue-100/50">{label}</span>
    </motion.li>
  );
}

// ── Single OTP digit box ──────────────────────────────────────
function OtpBox({
  value,
  onChange,
  onKeyDown,
  onPaste,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  const filled = !!value;
  return (
    <motion.div
      animate={filled ? { scale: [1, 1.1, 1] } : { scale: 1 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "relative w-12 h-14 rounded-xl border-2 transition-all duration-200",
        filled
          ? "border-blue-500 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.3)]"
          : "border-white/10 bg-white/5",
      )}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        maxLength={1}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className="absolute inset-0 w-full h-full text-center text-2xl font-bold font-mono bg-transparent text-white focus:outline-none caret-transparent"
        autoComplete="one-time-code"
      />
      {!value && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-2 h-0.5 bg-white/20 rounded-full" />
        </div>
      )}
    </motion.div>
  );
}

// ── Static data ───────────────────────────────────────────────
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 17.3) % 100,
  y: (i * 23.7) % 100,
  delay: (i * 0.45) % 5,
}));

const FEATURES = [
  { icon: BarChart3, label: "Dashboard con métricas en tiempo real" },
  { icon: PenSquare, label: "Editor de artículos con bloques de contenido" },
  { icon: Newspaper, label: "Gestión completa de noticias y artículos" },
  { icon: Users, label: "Administración de autores y roles" },
];

// ── Main component ────────────────────────────────────────────
export default function AdminLogin() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Only allow-listed same-origin paths (MCP consent) — never open redirects
  const afterLogin = safeAdminReturnPath(searchParams.get("return")) ?? "/admin/dashboard";

  const loading = useAppSelector(selectAdminAuthLoading);
  const error = useAppSelector(selectAdminAuthError);
  const codeSent = useAppSelector(selectAdminCodeSent);
  const codeSentEmail = useAppSelector(selectAdminCodeSentEmail);
  const isAuthenticated = useAppSelector(selectIsAdminAuthenticated);
  const token = useAppSelector(selectAdminToken);

  const emailForm = useFormik({
    initialValues: { email: "" },
    validationSchema: adminEmailSchema,
    onSubmit: (values) => {
      dispatch(requestAdminCode({ email: values.email.trim() }));
    },
  });
  const email = emailForm.values.email;

  const codeForm = useFormik({
    initialValues: { digits: ["", "", "", "", "", ""] },
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
      dispatch(
        verifyAdminCode({ email: codeSentEmail, code: values.digits.join("") }),
      );
    },
  });
  const digits = codeForm.values.digits;
  const setDigits = (
    next: string[] | ((prev: string[]) => string[]),
  ) => {
    const value = typeof next === "function" ? next(codeForm.values.digits) : next;
    void codeForm.setFieldValue("digits", value, false);
  };

  // 6 stable refs for digit inputs
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
        .catch(() => {});
    }
  }, [isAuthenticated, token, navigate, dispatch, afterLogin]);

  useEffect(() => {
    if (codeSent) setTimeout(() => digitRefs[0].current?.focus(), 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeSent]);


  const handleDigitChange = (idx: number, val: string) => {
    if (!val) {
      setDigits((d) => d.map((v, i) => (i === idx ? "" : v)));
      return;
    }
    setDigits((d) => d.map((v, i) => (i === idx ? val : v)));
    if (idx < 5) setTimeout(() => digitRefs[idx + 1].current?.focus(), 0);
  };

  const handleDigitKeyDown = (
    idx: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      setTimeout(() => digitRefs[idx - 1].current?.focus(), 0);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const newDigits = pasted
      .split("")
      .concat(Array(6 - pasted.length).fill(""));
    setDigits(newDigits);
    const focusIdx = Math.min(pasted.length, 5);
    setTimeout(() => digitRefs[focusIdx].current?.focus(), 0);
  };

  const code = digits.join("");


  const handleBack = () => {
    dispatch(resetCodeSent());
    setDigits(["", "", "", "", "", ""]);
  };

  return (
    <>
      <MetaHead
        title="Iniciar sesión"
        description="Acceso al panel de administración de Intelinota."
        noIndex
        includeSiteOrganization={false}
      />
      <div className="min-h-screen flex bg-[#07091a] overflow-hidden">
      {/* ── Left panel ───────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-14 relative overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#050917] via-[#091530] to-[#0d1d52]" />
        <Orb
          className="w-[520px] h-[520px] bg-blue-600/15 top-[-160px] right-[-120px]"
          delay={0}
        />
        <Orb
          className="w-[360px] h-[360px] bg-blue-400/10 bottom-[-100px] left-[-80px]"
          delay={2.5}
        />
        <Orb
          className="w-[220px] h-[220px] bg-indigo-400/12 top-[42%] left-[32%]"
          delay={4.5}
        />
        {PARTICLES.map((p, i) => (
          <Particle key={i} x={p.x} y={p.y} delay={p.delay} />
        ))}
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(59,130,246,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,.6) 1px,transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 mb-2"
          >
            <img
              src={SITE_LOGO}
              alt="INTELINOTA"
              className="h-9 w-auto object-contain"
            />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-[10px] tracking-[0.22em] uppercase text-blue-300/35 ml-[56px]"
          >
            Panel de Administración
          </motion.p>
        </div>

        {/* Tagline + features */}
        <div className="relative z-10 space-y-8">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12 }}
              className="text-[3.2rem] font-black text-white leading-[1.08] mb-5"
            >
              Gestiona tu portal{" "}
              <span className="relative inline-block">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-blue-400 to-blue-500">
                  desde aquí
                </span>
                <motion.span
                  className="absolute -bottom-1 left-0 w-full h-[2px] bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.9, delay: 0.85 }}
                />
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-blue-100/45 text-[0.95rem] leading-relaxed max-w-[22rem]"
            >
              Accede al panel de administración para crear y gestionar
              contenido, monitorear métricas y administrar tu equipo editorial.
            </motion.p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map(({ icon, label }, i) => (
              <FeatureItem
                key={label}
                icon={icon}
                label={label}
                delay={0.42 + i * 0.1}
              />
            ))}
          </ul>
        </div>

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="relative z-10 flex items-center gap-2 text-[11px] text-blue-400/30"
        >
          <Lock className="w-3 h-3" />
          <span>Acceso protegido con verificación por correo electrónico</span>
        </motion.div>
      </div>

      {/* ── Right panel ──────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        {/* Divider glow */}
        <div className="hidden lg:block absolute top-1/2 left-0 -translate-y-1/2 w-px h-3/4 bg-gradient-to-b from-transparent via-blue-500/15 to-transparent" />

        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:hidden flex items-center gap-2 mb-10"
          >
            <img
              src={SITE_LOGO}
              alt="INTELINOTA"
              className="h-7 w-auto object-contain"
            />
          </motion.div>

          <AnimatePresence mode="wait">
            {!codeSent ? (
              /* ─── Step 1: Email ─── */
              <motion.div
                key="email-step"
                initial={{ opacity: 0, x: 44 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -44 }}
                transition={{ duration: 0.32, ease: "easeInOut" }}
                className="space-y-8"
              >
                {/* Header */}
                <div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.08 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-5"
                  >
                    <Sparkles className="w-3 h-3" />
                    Sin contraseña requerida
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.13 }}
                    className="text-[2.4rem] font-black text-white mb-3 leading-tight"
                  >
                    Iniciar sesión
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-blue-100/40 text-[0.88rem] leading-relaxed"
                  >
                    Ingresa tu correo y te enviaremos un código de acceso de{" "}
                    <strong className="text-blue-300/70">6 dígitos</strong>. No
                    se requiere contraseña.
                  </motion.p>
                </div>

                {/* Form */}
                <motion.form
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.24 }}
                  onSubmit={emailForm.handleSubmit}
                  noValidate
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-sm font-medium text-blue-100/60"
                    >
                      Correo electrónico
                    </Label>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400/40 pointer-events-none group-focus-within:text-blue-400 transition-colors duration-200" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@intelinota.com"
                        name="email"
                        value={email}
                        onChange={emailForm.handleChange}
                        onBlur={emailForm.handleBlur}
                        aria-invalid={Boolean(emailForm.touched.email && emailForm.errors.email)}
                        className="pl-11 h-12 bg-white/5 border-white/10 hover:border-white/20 focus:border-blue-500 focus:bg-blue-500/5
                                   text-white placeholder:text-white/20 rounded-xl transition-all duration-200 text-base ring-0 focus-visible:ring-0"
                        autoComplete="email"
                        required
                      />
                    </div>
                    {emailForm.touched.email && emailForm.errors.email && (
                      <p role="alert" className="text-xs text-red-400">
                        {emailForm.errors.email}
                      </p>
                    )}
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                          {error}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.975 }}
                  >
                    <Button
                      type="submit"
                      disabled={loading || !email.trim()}
                      className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base
                                 shadow-[0_0_28px_rgba(59,130,246,0.32)] hover:shadow-[0_0_42px_rgba(59,130,246,0.5)]
                                 transition-all duration-300 disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none border-0"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4 mr-2" />
                      )}
                      {loading ? "Enviando código..." : "Continuar"}
                    </Button>
                  </motion.div>
                </motion.form>
              </motion.div>
            ) : (
              /* ─── Step 2: OTP ─── */
              <motion.div
                key="otp-step"
                initial={{ opacity: 0, x: 44 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -44 }}
                transition={{ duration: 0.32, ease: "easeInOut" }}
                className="space-y-8"
              >
                {/* Header */}
                <div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.06 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-5"
                  >
                    <Mail className="w-3 h-3" />
                    Código enviado a {codeSentEmail}
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-[2.4rem] font-black text-white mb-3 leading-tight"
                  >
                    Verifica tu identidad
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.16 }}
                    className="text-blue-100/40 text-[0.88rem] leading-relaxed"
                  >
                    Enviamos un código de 6 dígitos. Revisa tu bandeja de
                    entrada y escríbelo abajo.
                  </motion.p>
                </div>

                {/* Form */}
                <motion.form
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  onSubmit={codeForm.handleSubmit}
                  className="space-y-6"
                >
                  {/* OTP boxes */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-blue-100/60">
                      Código de verificación
                    </Label>
                    <div className="flex gap-2.5 justify-between">
                      {digits.map((digit, idx) => (
                        <OtpBox
                          key={idx}
                          value={digit}
                          onChange={(v) => handleDigitChange(idx, v)}
                          onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                          onPaste={handlePaste}
                          inputRef={digitRefs[idx]}
                        />
                      ))}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-[3px] bg-white/5 rounded-full overflow-hidden mt-1">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                        animate={{ width: `${(code.length / 6) * 100}%` }}
                        transition={{ duration: 0.12 }}
                      />
                    </div>
                    <p className="text-[11px] text-blue-400/28 text-center">
                      El código expira en 15 minutos
                    </p>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                          {error}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.975 }}
                  >
                    <Button
                      type="submit"
                      disabled={loading || code.length !== 6}
                      className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base
                                 shadow-[0_0_28px_rgba(59,130,246,0.32)] hover:shadow-[0_0_42px_rgba(59,130,246,0.5)]
                                 transition-all duration-300 disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none border-0"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 mr-2" />
                      )}
                      {loading ? "Verificando..." : "Acceder al panel"}
                    </Button>
                  </motion.div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBack}
                    className="w-full h-10 text-blue-400/35 hover:text-blue-300/60 hover:bg-white/4"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-2" />
                    Usar otro correo o reenviar código
                  </Button>
                </motion.form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
    </>
  );
}
