"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccessDenied, LoadingState } from "@/components/AccessDenied";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/constants";
import { getCatalogs, getProfilesByIds, getStudentRequests } from "@/lib/data";
import { genericActionError, hasUnsafeContent, sanitizeComment, unsafeInputError } from "@/lib/sanitize";
import { supabase } from "@/lib/supabase";
import type { Materia, Profile, Resena, Solicitud } from "@/lib/types";
import { useAuthProfile } from "@/hooks/useAuthProfile";

export default function MyRequestsPage() {
  const auth = useAuthProfile("estudiante");
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [reviewedIds, setReviewedIds] = useState<Set<number>>(new Set());
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [cancelTarget, setCancelTarget] = useState<Solicitud | null>(null);
  const [motivo, setMotivo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.userId) {
      setRequestsLoading(false);
      return;
    }
    setRequestsLoading(true);
    getStudentRequests(auth.userId).then(async ({ solicitudes, error }) => {
      setSolicitudes(solicitudes);
      setProfiles(await getProfilesByIds([...new Set(solicitudes.map((item) => item.tutor_id))]));
      if (solicitudes.length > 0) {
        const { data } = await supabase
          .from("resenas")
          .select("solicitud_id")
          .eq("estudiante_id", auth.userId)
          .in("solicitud_id", solicitudes.map((item) => item.id));
        setReviewedIds(new Set(((data ?? []) as Pick<Resena, "solicitud_id">[]).map((item) => item.solicitud_id)));
      } else {
        setReviewedIds(new Set());
      }
      const catalogs = await getCatalogs();
      setMaterias(catalogs.materias);
      setError(error || catalogs.error ? genericActionError : "");
      setRequestsLoading(false);
      if (new URLSearchParams(window.location.search).get("sent")) {
        setMessage("Tu solicitud ha sido enviada. El tutor responderá en un plazo de 24 a 48 horas.");
      }
    });
  }, [auth.userId]);

  const summary = useMemo(() => {
    return {
      pendiente: solicitudes.filter((item) => item.estado === "pendiente").length,
      aceptada: solicitudes.filter((item) => item.estado === "aceptada").length,
      rechazadasCanceladas: solicitudes.filter((item) => item.estado === "rechazada" || item.estado === "cancelada").length,
      finalizada: solicitudes.filter((item) => item.estado === "finalizada").length
    };
  }, [solicitudes]);

  const filteredSolicitudes = useMemo(() => {
    if (statusFilter === "pendiente") return solicitudes.filter((item) => item.estado === "pendiente");
    if (statusFilter === "aceptada") return solicitudes.filter((item) => item.estado === "aceptada");
    if (statusFilter === "rechazadas") return solicitudes.filter((item) => item.estado === "rechazada" || item.estado === "cancelada");
    if (statusFilter === "finalizada") return solicitudes.filter((item) => item.estado === "finalizada");
    return solicitudes;
  }, [solicitudes, statusFilter]);

  if (auth.loading) return <LoadingState />;
  if (auth.forbidden) return <AccessDenied />;

  async function cancelRequest() {
    if (!cancelTarget || !auth.userId) return;
    if (hasUnsafeContent(motivo)) {
      setError(unsafeInputError);
      return;
    }
    const cleanMotivo = sanitizeComment(motivo);
    const { error } = await supabase
      .from("solicitudes")
      .update({ estado: "cancelada", cancelada_por: auth.userId, motivo_cancelacion: cleanMotivo || null })
      .eq("id", cancelTarget.id);
    if (error) {
      setError(genericActionError);
      return;
    }
    setError("");
    setSolicitudes((items) => items.map((item) => (item.id === cancelTarget.id ? { ...item, estado: "cancelada" } : item)));
    setCancelTarget(null);
    setMotivo("");
    setMessage("Tu solicitud fue cancelada correctamente.");
  }

  function tutor(id: string) {
    return profiles.find((profile) => profile.id === id);
  }

  function materia(id: number | null) {
    return materias.find((item) => item.id === id)?.nombre ?? "Materia";
  }

  return (
    <main className="page requests-page">
      <div className="stack requests-heading">
        <span className="eyebrow">Mis solicitudes</span>
        <h1>Estado de tus tutorías</h1>
      </div>
      {message && <p className="success" aria-live="polite">{message}</p>}
      {error && <p className="error" aria-live="assertive">{error}</p>}
      <section className="requests-summary" aria-label="Resumen de solicitudes por estado" aria-live="polite">
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
          <strong>{summary.finalizada}</strong>
          <span>Finalizadas</span>
        </article>
      </section>
      <div className="request-filter-bar" aria-label="Filtrar solicitudes por estado">
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
      <section className="stack requests-list" aria-label="Lista de solicitudes">
        {requestsLoading ? (
          <div className="state-card" aria-live="polite">
            <h2>Cargando solicitudes...</h2>
          </div>
        ) : solicitudes.length === 0 ? (
          <div className="state-card">
            <h2>No tienes solicitudes todavía.</h2>
            <Link className="btn primary" href="/tutores">Buscar tutores</Link>
          </div>
        ) : filteredSolicitudes.length === 0 ? (
          <div className="state-card">
            <h2>No hay solicitudes en este estado.</h2>
          </div>
        ) : (
          filteredSolicitudes.map((solicitud) => {
            const tutorProfile = tutor(solicitud.tutor_id);
            const tutorName = tutorProfile?.full_name ?? "Tutor";
            const titleId = `solicitud-${solicitud.id}-title`;
            const canCancel = ["pendiente", "aceptada"].includes(solicitud.estado) && new Date(solicitud.fecha_reunion) > new Date();
            const reviewEligibleStatus = ["aceptada", "finalizada"].includes(String(solicitud.estado));
            const hasReview = reviewedIds.has(solicitud.id);
            const canReview = reviewEligibleStatus && !hasReview;
            return (
              <article className={`card request-card request-${solicitud.estado}`} aria-labelledby={titleId} key={solicitud.id}>
                <div className="card-header request-card-header">
                  <div>
                    <h2 id={titleId}>{tutorName}</h2>
                    <div className="request-meta-grid" aria-label="Detalles de la solicitud">
                      <span>{materia(solicitud.materia_id)}</span>
                      <span>{formatDateTime(solicitud.fecha_reunion)}</span>
                    </div>
                  </div>
                  <StatusBadge status={solicitud.estado} />
                </div>
                {solicitud.estado === "aceptada" ? (
                  <p className="request-note success">Tu solicitud fue aceptada. Ahora puedes contactar a tu tutor por WhatsApp: {tutorProfile?.whatsapp ?? "No registrado"}.</p>
                ) : solicitud.estado === "rechazada" ? (
                  <p className="request-note error">Tu solicitud fue rechazada. Puedes buscar otros tutores disponibles.</p>
                ) : (
                  <p className="request-note">El contacto se desbloquea cuando el tutor acepta la solicitud.</p>
                )}
                <div className="card-actions request-actions-row">
                  {canCancel && <button className="btn danger" type="button" onClick={() => setCancelTarget(solicitud)} aria-label={`Cancelar solicitud con ${tutorName}`}>Cancelar</button>}
                  {canReview && <Link className="btn subtle" href={`/resena/${solicitud.id}`} aria-label={`Agregar reseña para la tutoría con ${tutorName}`}>Agregar reseña</Link>}
                </div>
                {reviewEligibleStatus && hasReview && (
                  <p className="tutor-muted">Ya enviaste una reseña para esta tutoría.</p>
                )}
              </article>
            );
          })
        )}
      </section>
      {cancelTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cancel-title" aria-describedby="cancel-description">
          <div className="modal-box stack cancel-modal-box">
            <h2 id="cancel-title">Confirmar cancelación</h2>
            <p id="cancel-description">Esta acción actualizará la solicitud como cancelada.</p>
            <label>
              Motivo opcional
              <textarea value={motivo} maxLength={300} onChange={(event) => setMotivo(event.target.value.slice(0, 300))} aria-describedby="cancel-description" />
            </label>
            <div className="card-actions">
              <button className="btn danger" type="button" onClick={cancelRequest}>Confirmar</button>
              <button className="btn subtle" type="button" onClick={() => setCancelTarget(null)}>Volver</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
