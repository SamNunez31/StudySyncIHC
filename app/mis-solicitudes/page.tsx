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
          <button
            className={`request-filter-chip ${statusFilter === value ? "active" : ""}`}
            type="button"
            onClick={() => setStatusFilter(value)}
            aria-pressed={statusFilter === value}
            key={value}
          >
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
              <article
                className={`card request-card request-${solicitud.estado}`}
                aria-labelledby={titleId}
                key={solicitud.id}
              >
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
                  <p className="request-note success">
                    ✓ Solicitud aceptada — WhatsApp: <strong>{tutorProfile?.whatsapp ?? "No registrado"}</strong>
                  </p>
                ) : solicitud.estado === "rechazada" ? (
                  <p className="request-note error">
                    Tu solicitud fue rechazada. Puedes buscar otros tutores disponibles.
                  </p>
                ) : (
                  <p className="request-note">
                    El contacto se desbloquea cuando el tutor acepta la solicitud.
                  </p>
                )}

                <div className="card-actions request-actions-row">
                {canCancel && (
                  <button
                    type="button"
                    onClick={() => setCancelTarget(solicitud)}
                    aria-label={`Cancelar solicitud con ${tutorName}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: 0,
                      background: "#b91c1c",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      cursor: "pointer",
                      transition: "all 0.18s ease"
                    }}
                  >
                    Cancelar solicitud
                  </button>
                )}
                  {canReview && (
                    <Link
                      href={`/resena/${solicitud.id}`}
                      aria-label={`Agregar reseña para la tutoría con ${tutorName}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: 0,
                        background: "linear-gradient(135deg, #4932dc, #7423d6)",
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: "0.88rem",
                        textDecoration: "none",
                        transition: "all 0.18s ease"
                      }}
                    >
                      ★ Agregar reseña
                    </Link>
                  )}
                </div>

                {reviewEligibleStatus && hasReview && (
                  <p className="tutor-muted" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
                    ✓ Ya enviaste una reseña para esta tutoría.
                  </p>
                )}
              </article>
            );
          })
        )}
      </section>

      {cancelTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cancel-title" aria-describedby="cancel-description">
          <div className="modal-box stack cancel-modal-box" style={{ borderRadius: "24px", padding: "2rem", border: "1px solid #EDE9FE", boxShadow: "0 30px 80px rgba(6,3,30,0.25)" }}>
            
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "12px",
                background: "#FEF2F2", border: "1px solid #FECACA",
                display: "grid", placeItems: "center",
                color: "#b91c1c", fontSize: "1.3rem", flexShrink: 0
              }}>✕</div>
              <h2 id="cancel-title" style={{ margin: 0, fontSize: "1.3rem", color: "#17132a" }}>
                ¿Cancelar esta tutoría?
              </h2>
            </div>

            <div style={{
              padding: "12px 14px",
              borderRadius: "12px",
              background: "#F5F3FF",
              border: "1px solid #DDD6FE",
              fontSize: "0.9rem",
              color: "#4C1D95"
            }}>
              <strong>{profiles.find(p => p.id === cancelTarget.tutor_id)?.full_name ?? "Tutor"}</strong>
              {" — "}
              {formatDateTime(cancelTarget.fecha_reunion)}
            </div>

            <p id="cancel-description" style={{ margin: 0, color: "#667085", fontSize: "0.9rem" }}>
              Esta acción no se puede deshacer. El tutor será notificado de la cancelación.
            </p>

            <label style={{ display: "grid", gap: "6px", color: "#17132a", fontWeight: 700, fontSize: "0.9rem" }}>
              Motivo (opcional)
              <textarea
                value={motivo}
                maxLength={300}
                onChange={(event) => setMotivo(event.target.value.slice(0, 300))}
                placeholder="Ej: Ya no puedo en ese horario."
                style={{ borderRadius: "12px", border: "1.5px solid #DDD6FE", padding: "10px 12px", fontFamily: "inherit", minHeight: "80px", resize: "vertical" }}
              />
            </label>

            <div className="card-actions" style={{ justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn subtle" type="button" onClick={() => { setCancelTarget(null); setMotivo(""); }}>
                Volver
              </button>
              <button
                type="button"
                onClick={cancelRequest}
                style={{
                  padding: "10px 20px", borderRadius: "10px", border: 0,
                  background: "#b91c1c", color: "#fff",
                  fontWeight: 700, fontSize: "0.9rem", cursor: "pointer"
                }}
              >
                Sí, cancelar tutoría
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}