"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [statusFilter, setStatusFilter] = useState("todos");
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

  const summary = {
    pendiente: solicitudes.filter((item) => item.estado === "pendiente").length,
    aceptada: solicitudes.filter((item) => item.estado === "aceptada").length,
    rechazadasCanceladas: solicitudes.filter((item) => item.estado === "rechazada" || item.estado === "cancelada").length,
    finalizadas: solicitudes.filter((item) => item.estado === "finalizada" || item.estado === "completada").length
  };

  const filteredSolicitudes = useMemo(() => {
    if (statusFilter === "pendiente") return solicitudes.filter((item) => item.estado === "pendiente");
    if (statusFilter === "aceptada") return solicitudes.filter((item) => item.estado === "aceptada");
    if (statusFilter === "rechazadas") return solicitudes.filter((item) => item.estado === "rechazada" || item.estado === "cancelada");
    if (statusFilter === "finalizada") return solicitudes.filter((item) => item.estado === "finalizada" || item.estado === "completada");
    return solicitudes;
  }, [solicitudes, statusFilter]);

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
    <main className="page tutor-dashboard-page">
      <div className="stack tutor-dashboard-heading">
        <span className="eyebrow">Dashboard tutor</span>
        <h1>Solicitudes recibidas</h1>
      </div>
      {error && <p className="error" aria-live="assertive">{error}</p>}
      <section className="requests-summary" aria-label="Resumen de solicitudes recibidas por estado" aria-live="polite">
        <article className="request-stat-card pending">
          <strong>{summary.pendiente}</strong>
          <span>Pendientes</span>
        </article>
        <article className="request-stat-card accepted">
          <strong>{summary.aceptada}</strong>
          <span>Aceptadas</span>
        </article>
        <article className="request-stat-card rejected">
          <strong>{summary.rechazadasCanceladas}</strong>
          <span>Rechazadas / Canceladas</span>
        </article>
        <article className="request-stat-card finished">
          <strong>{summary.finalizadas}</strong>
          <span>Completadas / Finalizadas</span>
        </article>
      </section>
      <div className="request-filter-bar" aria-label="Filtrar solicitudes recibidas por estado">
        {[
          ["todos", "Todos"],
          ["pendiente", "Pendientes"],
          ["aceptada", "Aceptadas"],
          ["rechazadas", "Rechazadas/Canceladas"],
          ["finalizada", "Finalizadas"]
        ].map(([value, label]) => (
          <button className={`request-filter-chip ${statusFilter === value ? "active" : ""}`} type="button" onClick={() => setStatusFilter(value)} aria-pressed={statusFilter === value} key={value}>
            {label}
          </button>
        ))}
      </div>
      <section className="stack tutor-dashboard-list" aria-label="Lista de solicitudes recibidas">
        {solicitudes.length === 0 ? (
          <div className="state-card">
            <h2>No tienes solicitudes recibidas todavía.</h2>
            <p>Cuando un estudiante solicite una tutoría, aparecerá aquí.</p>
          </div>
        ) : filteredSolicitudes.length === 0 ? (
          <div className="state-card">
            <h2>No hay solicitudes en este estado.</h2>
          </div>
        ) : (
          filteredSolicitudes.map((solicitud) => {
            const actionable = solicitud.estado === "pendiente";
            const titleId = `tutor-request-${solicitud.id}-title`;
            return (
              <article className={`card tutor-request-card request-${solicitud.estado}`} aria-labelledby={titleId} key={solicitud.id}>
                <div className="card-header tutor-request-card-header">
                  <div>
                    <h2 id={titleId}>{student(solicitud.estudiante_id)}</h2>
                    <div className="request-meta-grid" aria-label="Detalles de la solicitud recibida">
                      <span>{materia(solicitud.materia_id)}</span>
                      <span>{formatDateTime(solicitud.fecha_reunion)}</span>
                    </div>
                  </div>
                  <StatusBadge status={solicitud.estado} />
                </div>
                <div className="card-actions tutor-request-actions">
                  <button className="btn tutor-accept-button" type="button" disabled={!actionable} onClick={() => updateStatus(solicitud.id, "aceptada")}>
                    Aceptar
                  </button>
                  <button className="btn tutor-reject-button" type="button" disabled={!actionable} onClick={() => updateStatus(solicitud.id, "rechazada")}>
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
