"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  const [cancelTarget, setCancelTarget] = useState<Solicitud | null>(null);
  const [motivo, setMotivo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.userId) return;
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
      }
      const catalogs = await getCatalogs();
      setMaterias(catalogs.materias);
      setError(error || catalogs.error ? genericActionError : "");
      if (new URLSearchParams(window.location.search).get("sent")) {
        setMessage("Tu solicitud ha sido enviada. El tutor responderá en un plazo de 24 a 48 horas.");
      }
    });
  }, [auth.userId]);

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
      {error && <p className="error">{error}</p>}
      <section className="stack requests-list">
        {solicitudes.length === 0 ? (
          <div className="state-card">
            <h2>No tienes solicitudes todavía.</h2>
            <Link className="btn primary" href="/tutores">Buscar tutores</Link>
          </div>
        ) : (
          solicitudes.map((solicitud) => {
            const tutorProfile = tutor(solicitud.tutor_id);
            const canCancel = ["pendiente", "aceptada"].includes(solicitud.estado) && new Date(solicitud.fecha_reunion) > new Date();
            const reviewEligibleStatus = ["aceptada", "finalizada"].includes(String(solicitud.estado));
            const meetingPassed = new Date(solicitud.fecha_reunion) <= new Date();
            const hasReview = reviewedIds.has(solicitud.id);
            const canReview = reviewEligibleStatus && meetingPassed && !hasReview;
            return (
              <article className="card request-card" key={solicitud.id}>
                <div className="card-header request-card-header">
                  <div>
                    <h2>{tutorProfile?.full_name ?? "Tutor"}</h2>
                    <div className="request-meta-grid">
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
                  {canCancel && <button className="btn danger" onClick={() => setCancelTarget(solicitud)}>Cancelar</button>}
                  {canReview && <Link className="btn subtle" href={`/resena/${solicitud.id}`}>Agregar reseña</Link>}
                </div>
                {reviewEligibleStatus && !meetingPassed && (
                  <p className="tutor-muted">Podrás dejar una reseña cuando la tutoría haya finalizado.</p>
                )}
                {reviewEligibleStatus && meetingPassed && hasReview && (
                  <p className="tutor-muted">Ya enviaste una reseña para esta tutoría.</p>
                )}
              </article>
            );
          })
        )}
      </section>
      {cancelTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
          <div className="modal-box stack cancel-modal-box">
            <h2 id="cancel-title">Confirmar cancelación</h2>
            <p>Esta acción actualizará la solicitud como cancelada.</p>
            <label>
              Motivo opcional
              <textarea value={motivo} maxLength={300} onChange={(event) => setMotivo(event.target.value.slice(0, 300))} />
            </label>
            <div className="card-actions">
              <button className="btn danger" onClick={cancelRequest}>Confirmar</button>
              <button className="btn subtle" onClick={() => setCancelTarget(null)}>Volver</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
