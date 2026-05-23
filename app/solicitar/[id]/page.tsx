"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessDenied, LoadingState } from "@/components/AccessDenied";
import { WeeklyCalendar } from "@/components/WeeklyCalendar";
import { getCatalogs, getTutorProfile } from "@/lib/data";
import { genericActionError } from "@/lib/sanitize";
import { supabase } from "@/lib/supabase";
import type { Disponibilidad, Materia, Profesor, Profile, Solicitud, TutorExperiencia } from "@/lib/types";
import { useAuthProfile } from "@/hooks/useAuthProfile";

type SelectedSlot = { dia_semana: number; hora_inicio: string; hora_fin: string; fecha: Date };

export default function RequestTutoringPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const auth = useAuthProfile("estudiante");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [experiencias, setExperiencias] = useState<TutorExperiencia[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [materiaId, setMateriaId] = useState("");
  const [selected, setSelected] = useState<SelectedSlot | null>(null);
  const [error, setError] = useState("");
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  useEffect(() => {
    Promise.all([getTutorProfile(id), getCatalogs()]).then(([tutor, catalogs]) => {
      setProfile(tutor.profile);
      setExperiencias(tutor.experiencias);
      setDisponibilidad(tutor.disponibilidad);
      setSolicitudes(tutor.solicitudes);
      setMaterias(catalogs.materias);
      setProfesores(catalogs.profesores);
      setMateriaId(String(tutor.experiencias[0]?.materia_id ?? ""));
      setError(tutor.error || catalogs.error ? genericActionError : "");
    });
  }, [id]);

  if (auth.loading) return <LoadingState />;
  if (auth.forbidden) return <AccessDenied />;

  const selectedExperience = experiencias.find((item) => String(item.materia_id) === materiaId) ?? experiencias[0];
  const selectedMateria = materias.find((item) => String(item.id) === materiaId);
  const selectedProfesor = profesores.find((item) => item.id === selectedExperience?.profesor_id);

  async function submit() {
    if (!auth.userId || !selected || !selectedExperience?.materia_id) return;
    setLoadingSubmit(true);
    setError("");
    const expiraAt = new Date();
    expiraAt.setHours(expiraAt.getHours() + 48);
    const { error } = await supabase.from("solicitudes").insert({
      estudiante_id: auth.userId,
      tutor_id: id,
      materia_id: selectedExperience.materia_id,
      fecha_reunion: selected.fecha.toISOString(),
      estado: "pendiente",
      expira_at: expiraAt.toISOString()
    });
    setLoadingSubmit(false);
    if (error) {
      setError(genericActionError);
      return;
    }
    router.replace("/mis-solicitudes?sent=1");
  }

  return (
    <main className="page">
      <div className="stack">
        <span className="eyebrow">Solicitud de tutoria</span>
        <h1>Selecciona un horario disponible</h1>
        <p>{profile?.full_name}</p>
      </div>
      {error && <p className="error">{error}</p>}
      <section className="split">
        <article className="card">
          <h2>Datos de la tutoria</h2>
          <label>
            Materia
            <select value={materiaId} onChange={(event) => setMateriaId(event.target.value)}>
              {experiencias.map((exp) => (
                <option value={exp.materia_id ?? ""} key={exp.id}>
                  {materias.find((item) => item.id === exp.materia_id)?.nombre ?? "Materia"}
                </option>
              ))}
            </select>
          </label>
          <div className="summary-grid">
            <span className="badge">Tutor: {profile?.full_name}</span>
            <span className="badge">Materia: {selectedMateria?.nombre ?? "-"}</span>
            <span className="badge">Profesor: {selectedProfesor?.nombre ?? "-"}</span>
            <span className="badge">Costo: ${Number(selectedExperience?.costo_hora ?? 0)}</span>
            <span className="badge">
              Fecha: {selected ? selected.fecha.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" }) : "Selecciona horario"}
            </span>
          </div>
          <button className="btn primary" disabled={!selected || loadingSubmit} onClick={submit}>
            {loadingSubmit ? "Enviando..." : "Confirmar solicitud"}
          </button>
        </article>
        <article className="card">
          <h2>Calendario semanal</h2>
          <WeeklyCalendar
            disponibilidad={disponibilidad}
            solicitudes={solicitudes}
            selectable
            selectedSlot={selected}
            onSelect={setSelected}
          />
        </article>
      </section>
    </main>
  );
}
