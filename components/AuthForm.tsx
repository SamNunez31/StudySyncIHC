"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  Camera,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  MessageCircle,
  UserRound,
  X
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { hasUnsafeContent, sanitizeBio, sanitizeEmail, sanitizePhone, sanitizeText, unsafeInputError } from "@/lib/sanitize";
import type { Role } from "@/lib/types";

type AuthMode = "login" | "registro";
type FormState = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  carrera: string;
  semestre: string;
  whatsapp: string;
  bio: string;
};
type FieldName = keyof FormState;
type FieldErrors = Partial<Record<FieldName | "general", string>>;
type TouchedFields = Partial<Record<FieldName, boolean>>;
type SelectedSlot = { day: number; start: string; end: string };

const initialForm: FormState = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  carrera: "",
  semestre: "",
  whatsapp: "",
  bio: ""
};

const dayOptions = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" }
];

const scheduleRows = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"].map(
  (start) => {
    const [hour] = start.split(":").map(Number);
    return { start, end: `${String(hour + 1).padStart(2, "0")}:00` };
  }
);

const avatarTypes = ["image/jpeg", "image/png", "image/webp"];
const avatarMaxSize = 2 * 1024 * 1024;
const fullNamePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)+$/;
const carreraPattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]{2,80}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function translateAuthError(message?: string) {
  const text = (message ?? "").toLowerCase();
  if (text.includes("invalid login") || text.includes("invalid credentials")) {
    return "El correo o la contraseña no son correctos.";
  }
  if (text.includes("already registered") || text.includes("already exists") || text.includes("user already registered")) {
    return "Este correo ya está registrado. Intenta iniciar sesión.";
  }
  if (text.includes("rate limit")) return "No se pudo completar la acción. Intenta nuevamente.";
  if (text.includes("invalid email")) return "Ingresa un correo electrónico válido.";
  if (text.includes("email not confirmed")) return "Tu correo aún no está confirmado.";
  return "No se pudo completar la acción. Intenta nuevamente.";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "grid" }}>
      <input {...props} type={show ? "text" : "password"} style={{ paddingRight: "44px" }} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        style={{
          position: "absolute",
          right: "12px",
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#706a86",
          padding: "4px",
          display: "flex",
          alignItems: "center"
        }}
      >
        {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </span>
  );
}

export function AuthForm({
  mode,
  embedded = false,
  onClose
}: {
  mode: AuthMode;
  embedded?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const defaultRole = (search.get("role") as Role) || "estudiante";
  const [activeMode, setActiveMode] = useState<AuthMode>(mode);
  const isRegister = activeMode === "registro";
  const [form, setForm] = useState<FormState>(initialForm);
  const [role, setRole] = useState<Role>(defaultRole === "tutor" ? "tutor" : "estudiante");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarError, setAvatarError] = useState("");

  const sanitized = useMemo(
    () => ({
      fullName: sanitizeText(form.fullName, 90),
      email: sanitizeEmail(form.email),
      password: form.password,
      confirmPassword: form.confirmPassword,
      carrera: sanitizeText(form.carrera, 80),
      semestre: Number(form.semestre),
      whatsapp: /^09\d{8}$/.test(sanitizePhone(form.whatsapp)) ? sanitizePhone(form.whatsapp) : "",
      bio: sanitizeBio(form.bio)
    }),
    [form]
  );

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview("");
      return;
    }
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile]);

  function closeAuth() {
    if (onClose) onClose();
    else router.push("/");
  }

  function switchMode(nextMode: AuthMode) {
    setActiveMode(nextMode);
    setErrors({});
    setTouched({});
    setSuccess("");
  }

  function validateField(field: FieldName, value = form[field]) {
    const values = { ...form, [field]: value };
    if (["fullName", "email", "carrera", "whatsapp", "bio"].includes(field) && hasUnsafeContent(value)) {
      return unsafeInputError;
    }

    const fullName = sanitizeText(values.fullName, 90);
    const email = sanitizeEmail(values.email);
    const password = values.password;
    const confirmPassword = values.confirmPassword;
    const carrera = sanitizeText(values.carrera, 80);
    const semestre = Number(values.semestre);
    const phone = sanitizePhone(values.whatsapp);
    const whatsapp = /^09\d{8}$/.test(phone) ? phone : "";
    const bio = sanitizeBio(values.bio);

    if (field === "fullName" && isRegister && !fullNamePattern.test(fullName)) {
      return "Ingresa tu nombre completo sin números. Ej: Sam Nuñez";
    }
    if (field === "email" && (!email || !emailPattern.test(email))) {
      return "Ingresa un correo electrónico válido.";
    }
    if (field === "password") {
      if (isRegister && !passwordPattern.test(password)) {
        return "La contraseña debe tener mínimo 8 caracteres, una letra y un número.";
      }
      if (!isRegister && !password) return "Ingresa tu contraseña.";
    }
    if (field === "confirmPassword" && isRegister && confirmPassword !== password) {
      return "Las contraseñas no coinciden.";
    }
    if (field === "carrera" && isRegister && (!carreraPattern.test(carrera) || /\d/.test(carrera))) {
      return "Ingresa una carrera válida. Ej: Ingeniería en Sistemas";
    }
    if (field === "semestre" && isRegister && (!Number.isInteger(semestre) || semestre < 1 || semestre > 10)) {
      return "El semestre debe estar entre 1 y 10.";
    }
    if (field === "whatsapp" && isRegister && role === "tutor" && !whatsapp) {
      return "Ingresa un número de WhatsApp válido. Ej: 0991234567";
    }
    if (field === "bio" && isRegister && role === "tutor" && (bio.length < 20 || bio.length > 250)) {
      return "Cuéntanos brevemente qué materias dominas y cómo ayudas.";
    }
    return "";
  }

  function validateAll() {
    const fields: FieldName[] = isRegister
      ? ["fullName", "email", "password", "confirmPassword", "carrera", "semestre", ...(role === "tutor" ? (["whatsapp", "bio"] as FieldName[]) : [])]
      : ["email", "password"];
    const next: FieldErrors = {};
    fields.forEach((field) => {
      const error = validateField(field);
      if (error) next[field] = error;
    });
    return next;
  }

  function updateField(field: FieldName, value: string) {
    const maxLength = field === "bio" ? 250 : field === "whatsapp" ? 10 : 120;
    const cleanValue = field === "whatsapp" ? value.replace(/\D/g, "").slice(0, 10) : value.slice(0, maxLength);
    setSuccess("");
    setForm((current) => ({ ...current, [field]: cleanValue }));
    setErrors((current) => {
      const next = { ...current, general: undefined };
      if (touched[field] || cleanValue.length > 0) {
        const fieldError = validateField(field, cleanValue);
        if (fieldError) next[field] = fieldError;
        else delete next[field];
      }
      return next;
    });
  }

  function blurField(field: FieldName) {
    setTouched((current) => ({ ...current, [field]: true }));
    const error = validateField(field);
    setErrors((current) => ({ ...current, [field]: error || undefined }));
  }

  async function redirectByRole(userId: string, fallbackRole?: string | null, source: AuthMode = "login") {
    const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
    const profileRole = data?.role ?? fallbackRole;
    const redirect = search.get("redirect");
    const tutorPath = source === "login" ? "/tutor/dashboard" : "/tutor/perfil";
    router.replace(redirect ?? (profileRole === "tutor" ? tutorPath : "/tutores"));
  }

  async function saveInitialAvailability(tutorId: string) {
    if (selectedSlots.length === 0) return null;
    const rows = selectedSlots.map((slot) => ({
      tutor_id: tutorId,
      dia_semana: slot.day,
      hora_inicio: slot.start,
      hora_fin: slot.end
    }));
    const { error } = await supabase.from("disponibilidad").insert(rows);
    return error;
  }

  async function uploadAvatar(userId: string) {
    if (!avatarFile) return null;
    const extension = avatarFile.type === "image/png" ? "png" : avatarFile.type === "image/webp" ? "webp" : "jpg";
    const filePath = `${userId}/avatar-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("avatars").upload(filePath, avatarFile, {
      contentType: avatarFile.type,
      upsert: true
    });
    if (error) throw error;
    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function whatsappAlreadyExists() {
    if (!isRegister || role !== "tutor" || !sanitized.whatsapp) return false;
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("whatsapp", sanitized.whatsapp)
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const nextErrors = validateAll();
    if (Object.keys(nextErrors).length > 0) {
      setTouched(
        Object.keys(nextErrors).reduce<TouchedFields>((acc, key) => {
          acc[key as FieldName] = true;
          return acc;
        }, {})
      );
      setErrors({ ...nextErrors, general: "Completa los campos obligatorios antes de continuar." });
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccess("");

    if (!isRegister) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: sanitized.email,
        password: sanitized.password
      });
      if (error || !data.user) {
        setLoading(false);
        setErrors({ general: translateAuthError(error?.message) });
        return;
      }
      setSuccess("Inicio de sesión exitoso. Redirigiendo…");
      await wait(1100);
      setLoading(false);
      await redirectByRole(data.user.id, null, "login");
      return;
    }

    if (await whatsappAlreadyExists()) {
      setLoading(false);
      setTouched((current) => ({ ...current, whatsapp: true }));
      setErrors({ whatsapp: "Este número de WhatsApp ya está registrado." });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: sanitized.email,
      password: sanitized.password
    });
    if (error || !data.user) {
      setLoading(false);
      setErrors({ general: translateAuthError(error?.message) });
      return;
    }

    let avatarUrl: string | null = null;
    try {
      avatarUrl = await uploadAvatar(data.user.id);
    } catch {
      setLoading(false);
      setErrors({ general: "No pudimos subir tu foto. Intenta con otra imagen o continúa sin foto." });
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      full_name: sanitized.fullName,
      role,
      carrera: sanitized.carrera,
      semestre: sanitized.semestre,
      avatar_url: avatarUrl,
      whatsapp: role === "tutor" ? sanitized.whatsapp : null,
      bio: role === "tutor" ? sanitized.bio : null
    });
    if (profileError) {
      setLoading(false);
      setErrors({ general: "No se pudo crear la cuenta. Intenta nuevamente." });
      return;
    }

    if (role === "tutor") {
      const availabilityError = await saveInitialAvailability(data.user.id);
      if (availabilityError) {
        setLoading(false);
        setErrors({ general: "Tu cuenta se creó, pero no pudimos guardar tus horarios iniciales." });
        return;
      }
    }

    setSuccess("Cuenta creada exitosamente. Redirigiendo…");
    await wait(1200);
    setLoading(false);
    await redirectByRole(data.user.id, role, "registro");
  }

  function toggleSlot(day: number, start: string, end: string) {
    setSelectedSlots((current) => {
      const exists = current.some((slot) => slot.day === day && slot.start === start);
      return exists ? current.filter((slot) => !(slot.day === day && slot.start === start)) : [...current, { day, start, end }];
    });
  }

  function isSelected(day: number, start: string) {
    return selectedSlots.some((slot) => slot.day === day && slot.start === start);
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setAvatarError("");
    setSuccess("");
    setErrors((current) => ({ ...current, general: undefined }));
    if (!file) {
      setAvatarFile(null);
      return;
    }
    if (!avatarTypes.includes(file.type) || file.size > avatarMaxSize) {
      setAvatarFile(null);
      setAvatarError("Sube una imagen JPG, PNG o WEBP menor a 2 MB.");
      event.target.value = "";
      return;
    }
    setAvatarFile(file);
  }

  return (
    <div className={embedded ? "study-auth-embedded" : "study-auth-shell"}>
      <section className={`study-auth-card ${isRegister ? "is-register" : "is-login"}`} aria-labelledby="auth-title">
        <div className="study-auth-modal-actions">
          <Link href="/" className="study-auth-brand">
            <span>
              <BookOpen size={25} aria-hidden="true" />
            </span>
            StudySync
          </Link>
          <button type="button" onClick={closeAuth} aria-label="Cerrar modal">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="study-auth-heading">
          <h1 id="auth-title">{isRegister ? "Crea tu cuenta" : "Iniciar sesión"}</h1>
          <p>
            {isRegister
              ? "Regístrate para solicitar tutorías, gestionar tus sesiones o configurar tu perfil como tutor."
              : "Accede a tus tutorías, solicitudes y sesiones pendientes."}
          </p>
        </div>

        <div className="study-auth-tabs" aria-label="Opciones de autenticación">
          <button type="button" className={!isRegister ? "active" : ""} onClick={() => switchMode("login")}>
            Iniciar sesión
          </button>
          <button type="button" className={isRegister ? "active" : ""} onClick={() => switchMode("registro")}>
            Crear cuenta
          </button>
        </div>

        <form className="study-auth-form" onSubmit={handleSubmit} noValidate>
          {isRegister && (
            <>
              <div className="study-avatar-picker">
                <div className="study-avatar-preview" aria-label="Vista previa de foto de perfil">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Foto de perfil seleccionada" />
                  ) : (
                    <UserRound size={34} aria-hidden="true" />
                  )}
                </div>
                <div className="study-avatar-copy">
                  <label className="study-avatar-button" htmlFor="avatar">
                    <Camera size={18} aria-hidden="true" />
                    Subir foto
                  </label>
                  <input id="avatar" className="study-avatar-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} />
                  <p>Opcional. JPG, PNG o WEBP hasta 2 MB.</p>
                  {avatarError && <span className="study-field-error">{avatarError}</span>}
                </div>
              </div>

              <Field id="fullName" label="Nombre completo" icon={<UserRound size={18} aria-hidden="true" />} error={errors.fullName} valid={Boolean(touched.fullName && !errors.fullName && form.fullName)}>
                <input id="fullName" value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} onBlur={() => blurField("fullName")} placeholder="Ej: Sam Nuñez" autoComplete="name" aria-invalid={Boolean(errors.fullName)} />
              </Field>
            </>
          )}

          <Field id="email" label="Correo electrónico" icon={<Mail size={18} aria-hidden="true" />} error={errors.email} valid={Boolean(touched.email && !errors.email && form.email)}>
            <input id="email" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} onBlur={() => blurField("email")} placeholder="Ej: sam@gmail.com" autoComplete="email" aria-invalid={Boolean(errors.email)} />
          </Field>

          <Field id="password" label="Contraseña" icon={<Lock size={18} aria-hidden="true" />} error={errors.password} valid={Boolean(touched.password && !errors.password && form.password)}>
            <PasswordInput id="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} onBlur={() => blurField("password")} placeholder="Mínimo 8 caracteres" autoComplete={isRegister ? "new-password" : "current-password"} aria-invalid={Boolean(errors.password)} />
          </Field>

          {isRegister && (
            <>
              <Field id="confirmPassword" label="Confirmar contraseña" icon={<Lock size={18} aria-hidden="true" />} error={errors.confirmPassword} valid={Boolean(touched.confirmPassword && !errors.confirmPassword && form.confirmPassword)}>
                <PasswordInput id="confirmPassword" value={form.confirmPassword} onChange={(e) => updateField("confirmPassword", e.target.value)} onBlur={() => blurField("confirmPassword")} placeholder="Repite tu contraseña" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} />
              </Field>

              <div className="study-auth-grid">
                <Field id="carrera" label="Carrera" icon={<BriefcaseBusiness size={18} aria-hidden="true" />} error={errors.carrera} valid={Boolean(touched.carrera && !errors.carrera && form.carrera)}>
                  <input id="carrera" value={form.carrera} onChange={(e) => updateField("carrera", e.target.value)} onBlur={() => blurField("carrera")} placeholder="Ej: Ingeniería en Sistemas" aria-invalid={Boolean(errors.carrera)} />
                </Field>
                <Field id="semestre" label="Semestre" icon={<GraduationCap size={18} aria-hidden="true" />} error={errors.semestre} valid={Boolean(touched.semestre && !errors.semestre && form.semestre)}>
                  <input id="semestre" type="number" min="1" max="10" value={form.semestre} onChange={(e) => updateField("semestre", e.target.value)} onBlur={() => blurField("semestre")} placeholder="Ej: 5" aria-invalid={Boolean(errors.semestre)} />
                </Field>
              </div>

              <fieldset className="study-role-field">
                <legend>Rol</legend>
                <div className="study-role-options">
                  {(["estudiante", "tutor"] as Role[]).map((option) => (
                    <button type="button" className={role === option ? "selected" : ""} onClick={() => setRole(option)} aria-pressed={role === option} key={option}>
                      {option === "estudiante" ? "Estudiante" : "Tutor"}
                    </button>
                  ))}
                </div>
              </fieldset>

              {role === "tutor" && (
                <section className="study-tutor-extra" aria-label="Datos de tutor">
                  <Field id="whatsapp" label="WhatsApp" icon={<MessageCircle size={18} aria-hidden="true" />} error={errors.whatsapp} valid={Boolean(touched.whatsapp && !errors.whatsapp && form.whatsapp)}>
                    <input id="whatsapp" value={form.whatsapp} onChange={(e) => updateField("whatsapp", e.target.value)} onBlur={() => blurField("whatsapp")} inputMode="tel" placeholder="Ej: 0991234567" maxLength={10} aria-invalid={Boolean(errors.whatsapp)} />
                  </Field>

                  <Field id="bio" label="Bio" error={errors.bio} valid={Boolean(touched.bio && !errors.bio && form.bio)}>
                    <textarea id="bio" value={form.bio} onChange={(e) => updateField("bio", e.target.value)} onBlur={() => blurField("bio")} placeholder="Ej: Ayudo en Programación I, bases de datos y ejercicios prácticos." maxLength={250} aria-invalid={Boolean(errors.bio)} />
                    <span className="study-char-count">{form.bio.length}/250</span>
                  </Field>

                  <div className="study-schedule-section">
                    <div>
                      <h2>Selecciona tus horarios de preferencia</h2>
                      <p>Luego podrás ajustar tu disponibilidad detallada desde tu panel de tutor.</p>
                    </div>
                    <div className="study-schedule-scroll">
                      <div className="study-schedule-grid" role="grid" aria-label="Horarios de preferencia">
                        <div className="study-schedule-head">Hora</div>
                        {dayOptions.map((day) => (
                          <div className="study-schedule-head" key={day.value}>{day.label}</div>
                        ))}
                        {scheduleRows.map((row) => (
                          <div className="study-schedule-row" key={row.start}>
                            <div className="study-schedule-time">{row.start}</div>
                            {dayOptions.map((day) => {
                              const selected = isSelected(day.value, row.start);
                              return (
                                <button
                                  type="button"
                                  className={`study-schedule-cell ${selected ? "selected" : ""}`}
                                  onClick={() => toggleSlot(day.value, row.start, row.end)}
                                  aria-pressed={selected}
                                  aria-label={`${day.label} ${row.start}`}
                                  key={`${day.value}-${row.start}`}
                                >
                                  {selected ? "Activo" : ""}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <div className="study-schedule-mobile" aria-label="Horarios de preferencia por día">
                        {dayOptions.map((day) => (
                          <section className="study-schedule-day" key={day.value}>
                            <h3>{day.label}</h3>
                            <div>
                              {scheduleRows.map((row) => {
                                const selected = isSelected(day.value, row.start);
                                return (
                                  <button
                                    type="button"
                                    className={selected ? "selected" : ""}
                                    onClick={() => toggleSlot(day.value, row.start, row.end)}
                                    aria-pressed={selected}
                                    key={`${day.value}-${row.start}-mobile`}
                                  >
                                    {row.start}
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {errors.general && (
            <p className="study-form-alert" role="alert" aria-live="assertive">
              {errors.general}
            </p>
          )}

          {success && (
            <p className="study-form-success" aria-live="polite">
              {success}
            </p>
          )}

          <button className="study-submit-button" type="submit" disabled={loading}>
            {loading ? (isRegister ? "Creando cuenta…" : "Iniciando sesión…") : isRegister ? "Crear cuenta" : "Iniciar sesión"}
          </button>

          <p className="study-auth-switch">
            {isRegister ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
            <button type="button" onClick={() => switchMode(isRegister ? "login" : "registro")}>
              {isRegister ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  error,
  valid,
  children
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  error?: string;
  valid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`study-field ${error ? "has-error" : ""} ${valid ? "is-valid" : ""}`} htmlFor={id}>
      <span className="study-field-label">{label}</span>
      <span className="study-input-shell">
        {icon && <span className="study-input-icon">{icon}</span>}
        {children}
      </span>
      {error && (
        <span className="study-field-error" role="alert" aria-live="polite">
          {error}
        </span>
      )}
    </label>
  );
}