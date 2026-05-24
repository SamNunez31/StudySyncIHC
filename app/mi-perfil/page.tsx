"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Camera, UserRound } from "lucide-react";
import { genericActionError, hasUnsafeContent, sanitizeBio, sanitizePhone, sanitizeText, unsafeInputError } from "@/lib/sanitize";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

const avatarTypes = ["image/jpeg", "image/png", "image/webp"];
const avatarMaxSize = 2 * 1024 * 1024;

export default function MyProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [carrera, setCarrera] = useState("");
  const [semestre, setSemestre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setLoading(false);
        return;
      }

      setUserId(userData.user.id);
      setEmail(userData.user.email ?? "");
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single<Profile>();
      if (error) {
        console.error(error);
        setError(genericActionError);
        setLoading(false);
        return;
      }

      setProfile(data);
      setFullName(data.full_name ?? "");
      setCarrera(data.carrera ?? "");
      setSemestre(String(data.semestre ?? ""));
      setWhatsapp(data.whatsapp ?? "");
      setBio(data.bio ?? "");
      setAvatarPreview(data.avatar_url ?? "");
      setLoading(false);
    }

    loadProfile();
  }, []);

  useEffect(() => {
    if (!avatarFile) return;
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile]);

  const initials = useMemo(() => {
    return (fullName || profile?.full_name || "Usuario")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [fullName, profile?.full_name]);

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setAvatarError("");
    if (!file) {
      setAvatarFile(null);
      return;
    }
    if (!avatarTypes.includes(file.type) || file.size > avatarMaxSize) {
      setAvatarError("Sube una imagen JPG, PNG o WEBP menor a 2 MB.");
      event.target.value = "";
      return;
    }
    setAvatarFile(file);
  }

  async function uploadAvatar() {
    if (!avatarFile || !userId) return profile?.avatar_url ?? null;
    const extension = avatarFile.type === "image/png" ? "png" : avatarFile.type === "image/webp" ? "webp" : "jpg";
    const filePath = `${userId}/profile-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("avatars").upload(filePath, avatarFile, {
      contentType: avatarFile.type,
      upsert: true
    });
    if (error) throw error;
    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !userId || saving) return;
    setError("");
    setMessage("");

    if ([fullName, carrera, whatsapp, bio].some(hasUnsafeContent)) {
      setError(unsafeInputError);
      return;
    }

    const cleanFullName = sanitizeText(fullName, 80);
    const cleanCarrera = sanitizeText(carrera, 80);
    const cleanWhatsapp = sanitizePhone(whatsapp);
    const cleanBio = sanitizeBio(bio);
    const cleanSemestre = Number(semestre);

    if (!cleanFullName || !cleanCarrera || !Number.isInteger(cleanSemestre) || cleanSemestre < 1 || cleanSemestre > 10) {
      setError("Completa los campos obligatorios antes de continuar.");
      return;
    }

    setSaving(true);
    try {
      const avatarUrl = await uploadAvatar();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: cleanFullName,
          carrera: cleanCarrera,
          semestre: cleanSemestre,
          whatsapp: cleanWhatsapp || null,
          bio: cleanBio || null,
          avatar_url: avatarUrl
        })
        .eq("id", userId);

      if (error) throw error;
      setProfile({ ...profile, full_name: cleanFullName, carrera: cleanCarrera, semestre: cleanSemestre, whatsapp: cleanWhatsapp || null, bio: cleanBio || null, avatar_url: avatarUrl });
      setAvatarFile(null);
      setMessage("Perfil actualizado correctamente.");
    } catch (updateError) {
      console.error(updateError);
      setError("No se pudo actualizar el perfil. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="page profile-edit-page">
        <section className="profile-edit-card">
          <p>Cargando perfil...</p>
        </section>
      </main>
    );
  }

  if (!userId || !profile) {
    return (
      <main className="page profile-edit-page">
        <section className="profile-edit-card">
          <h1>Mi perfil</h1>
          <p>Inicia sesión para editar tu perfil.</p>
          <Link className="btn primary" href="/login?redirect=/mi-perfil">
            Iniciar sesión
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page profile-edit-page">
      <section className="profile-edit-card" aria-labelledby="profile-title">
        <div className="profile-edit-heading">
          <div>
            <span className="eyebrow">Cuenta StudySync</span>
            <h1 id="profile-title">Mi perfil</h1>
            <p>Actualiza tus datos personales</p>
          </div>
        </div>

        <form className="profile-edit-form" onSubmit={handleSubmit}>
          <div className="profile-avatar-row">
            <div className="profile-edit-avatar" role="img" aria-label={`Avatar de ${fullName || "usuario"}`}>
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt={`Foto de perfil de ${fullName || "usuario"}`} />
              ) : (
                <span>{initials || <UserRound size={28} aria-hidden="true" />}</span>
              )}
            </div>
            <div>
              <label className="profile-upload-button" htmlFor="avatar">
                <Camera size={17} aria-hidden="true" />
                Cambiar foto
              </label>
              <input id="avatar" className="profile-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} />
              <p className="profile-help">Opcional. JPG, PNG o WEBP menor a 2 MB.</p>
              {avatarError && <p className="profile-field-error" role="alert">{avatarError}</p>}
            </div>
          </div>

          <div className="profile-form-grid">
            <label htmlFor="full_name">
              Nombre completo
              <input id="full_name" value={fullName} maxLength={80} onChange={(event) => setFullName(event.target.value)} required />
            </label>
            <label htmlFor="email">
              Correo
              <input id="email" value={email} readOnly />
            </label>
            <label htmlFor="carrera">
              Carrera
              <input id="carrera" value={carrera} maxLength={80} onChange={(event) => setCarrera(event.target.value)} required />
            </label>
            <label htmlFor="semestre">
              Semestre
              <input id="semestre" type="number" min="1" max="10" value={semestre} onChange={(event) => setSemestre(event.target.value)} required />
            </label>
            <label htmlFor="role">
              Rol
              <input id="role" value={profile.role ?? ""} readOnly />
            </label>
            <label htmlFor="whatsapp">
              WhatsApp o teléfono
              <input id="whatsapp" value={whatsapp} maxLength={10} onChange={(event) => setWhatsapp(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Ej: 0991234567" />
            </label>
          </div>

          <label className="profile-bio-field" htmlFor="bio">
            Bio / descripción
            <textarea id="bio" value={bio} maxLength={250} onChange={(event) => setBio(event.target.value.slice(0, 250))} />
            <span>{bio.length}/250</span>
          </label>

          <div className="profile-feedback" aria-live="polite">
            {message && <p className="success">{message}</p>}
            {error && <p className="error">{error}</p>}
          </div>

          <button className="btn primary profile-save-button" type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </section>
    </main>
  );
}
