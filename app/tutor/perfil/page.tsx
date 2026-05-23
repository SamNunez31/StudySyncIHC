"use client";

import { FormEvent, useEffect, useState } from "react";
import { AccessDenied, LoadingState } from "@/components/AccessDenied";
import { getCatalogs, getTutorProfile } from "@/lib/data";
import { genericActionError, hasUnsafeContent, sanitizeBio, sanitizePhone, sanitizeText, unsafeInputError } from "@/lib/sanitize";
import { supabase } from "@/lib/supabase";
import type { Materia, Profesor, Profile, TutorExperiencia } from "@/lib/types";
import { useAuthProfile } from "@/hooks/useAuthProfile";

export default function TutorProfileEditPage() {
  const auth = useAuthProfile("tutor");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [experiencias, setExperiencias] = useState<TutorExperiencia[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.userId) return;
    Promise.all([getTutorProfile(auth.userId), getCatalogs()]).then(([tutor, catalogs]) => {
      setProfile(tutor.profile);
      setExperiencias(tutor.experiencias);
      setMaterias(catalogs.materias);
      setProfesores(catalogs.profesores);
      setError(tutor.error || catalogs.error ? genericActionError : "");
    });
  }, [auth.userId]);

  if (auth.loading) return <LoadingState />;
  if (auth.forbidden) return <AccessDenied />;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.userId) return;
    const form = new FormData(event.currentTarget);
    const rawFullName = String(form.get("full_name") ?? "");
    const rawCarrera = String(form.get("carrera") ?? "");
    const rawWhatsapp = String(form.get("whatsapp") ?? "");
    const rawBio = String(form.get("bio") ?? "");
    const semestre = Number(form.get("semestre") ?? 1);
    if ([rawFullName, rawCarrera, rawWhatsapp, rawBio].some(hasUnsafeContent)) {
      setError(unsafeInputError);
      return;
    }
    const fullName = sanitizeText(rawFullName, 80);
    const carrera = sanitizeText(rawCarrera, 80);
    const whatsapp = sanitizePhone(rawWhatsapp);
    const bio = sanitizeBio(rawBio);
    if (!fullName || /\d/.test(fullName) || !carrera || /\d/.test(carrera) || !Number.isInteger(semestre) || semestre < 1 || semestre > 10) {
      setError("Revisa nombre, carrera y semestre antes de guardar.");
      return;
    }
    if (whatsapp && !/^09\d{8}$/.test(whatsapp)) {
      setError("Ingresa un numero de WhatsApp valido. Ej: 0991234567");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        carrera,
        semestre,
        whatsapp,
        bio
      })
      .eq("id", auth.userId);

    if (error) {
      setError(genericActionError);
      return;
    }
    setError("");
    setMessage("Perfil actualizado correctamente.");
  }

  async function addExperience(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.userId) return;
    const form = new FormData(event.currentTarget);
    const materiaId = Number(form.get("materia_id"));
    const profesorId = Number(form.get("profesor_id"));
    const costoHora = Number(form.get("costo_hora"));
    if (!Number.isInteger(materiaId) || !Number.isInteger(profesorId) || !Number.isFinite(costoHora) || costoHora < 0) {
      setError(genericActionError);
      return;
    }
    const { data, error } = await supabase
      .from("tutor_experiencia")
      .insert({
        tutor_id: auth.userId,
        materia_id: materiaId,
        profesor_id: profesorId,
        costo_hora: costoHora,
        ayudante_catedra: form.get("ayudante_catedra") === "on"
      })
      .select("*")
      .single();
    if (error) {
      setError(genericActionError);
      return;
    }
    setError("");
    setExperiencias((items) => [...items, data as TutorExperiencia]);
    (event.currentTarget as HTMLFormElement).reset();
    setMessage("Materia agregada correctamente.");
  }

  async function removeExperience(id: number) {
    const { error } = await supabase.from("tutor_experiencia").delete().eq("id", id);
    if (error) {
      setError(genericActionError);
      return;
    }
    setError("");
    setExperiencias((items) => items.filter((item) => item.id !== id));
  }

  function materiaName(id: number | null) {
    return materias.find((item) => item.id === id)?.nombre ?? "Materia";
  }

  function profesorName(id: number | null) {
    return profesores.find((item) => item.id === id)?.nombre ?? "Profesor";
  }

  return (
    <main className="page">
      <div className="stack">
        <span className="eyebrow">Perfil tutor</span>
        <h1>Configura tu perfil publico</h1>
        <p>El WhatsApp no aparece en tu perfil publico; se muestra solo cuando aceptas una solicitud.</p>
      </div>
      {message && <p className="success" aria-live="polite">{message}</p>}
      {error && <p className="error">{error}</p>}
      <section className="split">
        <form className="card stack" onSubmit={saveProfile}>
          <h2>Datos personales</h2>
          <label>
            Nombre completo
            <input name="full_name" defaultValue={profile?.full_name ?? ""} required />
          </label>
          <label>
            Carrera
            <input name="carrera" defaultValue={profile?.carrera ?? ""} required />
          </label>
          <label>
            Semestre
            <input name="semestre" type="number" min="1" max="12" defaultValue={profile?.semestre ?? 1} required />
          </label>
          <label>
            WhatsApp
            <input name="whatsapp" defaultValue={profile?.whatsapp ?? ""} placeholder="+593..." />
          </label>
          <label>
            Bio
            <textarea name="bio" defaultValue={profile?.bio ?? ""} />
          </label>
          <button className="btn primary" type="submit">Guardar perfil</button>
        </form>
        <section className="stack">
          <form className="card stack" onSubmit={addExperience}>
            <h2>Materias que dominas</h2>
            <label>
              Materia
              <select name="materia_id" required>
                {materias.map((materia) => (
                  <option value={materia.id} key={materia.id}>{materia.nombre}</option>
                ))}
              </select>
            </label>
            <label>
              Profesor
              <select name="profesor_id" required>
                {profesores.map((profesor) => (
                  <option value={profesor.id} key={profesor.id}>{profesor.nombre}</option>
                ))}
              </select>
            </label>
            <label>
              Costo por hora
              <input name="costo_hora" type="number" min="0" step="0.5" required />
            </label>
            <label className="toolbar">
              <input style={{ width: 18 }} name="ayudante_catedra" type="checkbox" />
              Fui ayudante de catedra
            </label>
            <button className="btn primary" type="submit">Agregar materia</button>
          </form>
          <article className="card stack">
            <h2>Experiencia registrada</h2>
            {experiencias.length === 0 ? (
              <p>Agrega al menos una materia para aparecer mejor en busqueda.</p>
            ) : (
              experiencias.map((exp) => (
                <div className="mini-row" key={exp.id}>
                  <div>
                    <strong>{materiaName(exp.materia_id)}</strong>
                    <p>{profesorName(exp.profesor_id)} · ${Number(exp.costo_hora ?? 0)}</p>
                  </div>
                  <button className="btn subtle" onClick={() => removeExperience(exp.id)}>Quitar</button>
                </div>
              ))
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
