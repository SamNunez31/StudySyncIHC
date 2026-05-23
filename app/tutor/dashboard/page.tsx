"use client";

import { useEffect, useState } from "react";
import { AccessDenied, LoadingState } from "@/components/AccessDenied";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/constants";
import { getCatalogs, getProfilesByIds, getTutorRequests } from "@/lib/data";
import { genericActionError } from "@/lib/sanitize";
import { supabase } from "@/lib/supabase";
import type { Materia, Profile, Solicitud } from "@/lib/types";
import { useAuthProfile } from "@/hooks/useAuthProfile";

export default function TutorDashboardPage() {
  const auth = useAuthProfile("tutor");
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.userId) return;
    getTutorRequests(auth.userId).then(async ({ solicitudes, error }) => {
      setSolicitudes(solicitudes);
      setStudents(await getProfilesByIds([...new Set(solicitudes.map((item) => item.estudiante_id))]));
      const catalogs = await getCatalogs();
      setMaterias(catalogs.materias);
      setError(error || catalogs.error ? genericActionError : "");
    });
  }, [auth.userId]);

  if (auth.loading) return <LoadingState />;
  if (auth.forbidden) return <AccessDenied />;

  async function updateStatus(id: number, estado: "aceptada" | "rechazada") {
    const { error } = await supabase.from("solicitudes").update({ estado }).eq("id", id);
    if (error) {
      setError(genericActionError);
      return;
    }
    setError("");
    setSolicitudes((items) => items.map((item) => (item.id === id ? { ...item, estado } : item)));
  }

  function student(id: string) {
    return students.find((profile) => profile.id === id)?.full_name ?? "Estudiante";
  }

  function materia(id: number | null) {
    return materias.find((item) => item.id === id)?.nombre ?? "Materia";
  }

  return (
    <main className="page">
      <div className="stack">
        <span className="eyebrow">Dashboard tutor</span>
        <h1>Solicitudes recibidas</h1>
      </div>
      {error && <p className="error">{error}</p>}
      <section className="stack">
        {solicitudes.length === 0 ? (
          <div className="state-card">
            <h2>Aun no tienes solicitudes.</h2>
            <p>Cuando un estudiante reserve un bloque aparecera aqui.</p>
          </div>
        ) : (
          solicitudes.map((solicitud) => {
            const actionable = solicitud.estado === "pendiente";
            return (
              <article className="card" key={solicitud.id}>
                <div className="card-header">
                  <div>
                    <h2>{student(solicitud.estudiante_id)}</h2>
                    <p>{materia(solicitud.materia_id)} · {formatDateTime(solicitud.fecha_reunion)}</p>
                  </div>
                  <StatusBadge status={solicitud.estado} />
                </div>
                <div className="card-actions">
                  <button className="btn primary" disabled={!actionable} onClick={() => updateStatus(solicitud.id, "aceptada")}>
                    Aceptar
                  </button>
                  <button className="btn subtle" disabled={!actionable} onClick={() => updateStatus(solicitud.id, "rechazada")}>
                    Rechazar
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
