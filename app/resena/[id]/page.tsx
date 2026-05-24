"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AccessDenied, LoadingState } from "@/components/AccessDenied";
import { genericActionError, hasUnsafeContent, sanitizeComment, unsafeInputError } from "@/lib/sanitize";
import { supabase } from "@/lib/supabase";
import type { Resena, Solicitud } from "@/lib/types";
import { useAuthProfile } from "@/hooks/useAuthProfile";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const auth = useAuthProfile("estudiante");
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [existingReview, setExistingReview] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.userId) return;
    let mounted = true;
    async function loadReviewContext() {
      setLoadingData(true);
      const solicitudId = Number(id);
      if (!Number.isInteger(solicitudId)) {
        setError(genericActionError);
        setLoadingData(false);
        return;
      }

      const [{ data: solicitudData, error: solicitudError }, { data: reviewData, error: reviewError }] = await Promise.all([
        supabase.from("solicitudes").select("*").eq("id", solicitudId).single<Solicitud>(),
        supabase.from("resenas").select("id").eq("solicitud_id", solicitudId).eq("estudiante_id", auth.userId).maybeSingle<Pick<Resena, "id">>()
      ]);

      if (!mounted) return;
      if (solicitudError || reviewError || !solicitudData) {
        setError(genericActionError);
        setLoadingData(false);
        return;
      }
      if (solicitudData.estudiante_id !== auth.userId) {
        setError("No tienes permisos para realizar esta acción.");
        setLoadingData(false);
        return;
      }
      setSolicitud(solicitudData);
      setExistingReview(Boolean(reviewData));
      setError("");
      setLoadingData(false);
    }

    loadReviewContext();
    return () => {
      mounted = false;
    };
  }, [auth.userId, id]);

  if (auth.loading || loadingData) return <LoadingState />;
  if (auth.forbidden) return <AccessDenied />;

  const validStatus = solicitud ? ["aceptada", "finalizada"].includes(String(solicitud.estado)) : false;
  const meetingFinished = solicitud ? new Date(solicitud.fecha_reunion) <= new Date() : false;
  const canSubmit = Boolean(solicitud && validStatus && meetingFinished && !existingReview);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.userId || !solicitud || submitting) return;
    setError("");
    setSuccess("");

    if (!rating) {
      setError("Selecciona una calificación.");
      return;
    }
    if (!validStatus || !meetingFinished) {
      setError("La tutoría aún no ha finalizado.");
      return;
    }
    if (existingReview) {
      setError("Ya enviaste una reseña para esta tutoría.");
      return;
    }
    if (hasUnsafeContent(comment)) {
      setError(unsafeInputError);
      return;
    }

    const cleanComment = sanitizeComment(comment);
    setSubmitting(true);
    const { error: insertError } = await supabase.from("resenas").insert({
      solicitud_id: solicitud.id,
      estudiante_id: auth.userId,
      tutor_id: solicitud.tutor_id,
      calificacion: rating,
      comentario: cleanComment || null
    });
    setSubmitting(false);
    if (insertError) {
      setError("No se pudo enviar la reseña. Intenta nuevamente.");
      return;
    }
    setExistingReview(true);
    setSuccess("Reseña enviada correctamente.");
    window.setTimeout(() => router.replace("/mis-solicitudes"), 900);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card review-card">
        <h1>Agregar reseña</h1>
        <p>Cuéntanos cómo fue tu tutoría. Tu opinión ayudará a otros estudiantes a decidir mejor.</p>

        {!meetingFinished && <p className="error">La tutoría aún no ha finalizado.</p>}
        {existingReview && <p className="error">Ya enviaste una reseña para esta tutoría.</p>}
        {error && <p className="error" role="alert" aria-live="assertive">{error}</p>}
        {success && <p className="success" aria-live="polite">{success}</p>}

        <form className="review-form" onSubmit={submit}>
          <fieldset className="review-stars">
            <legend>Calificación</legend>
            <div>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  type="button"
                  className={rating >= value ? "selected" : ""}
                  onClick={() => setRating(value)}
                  aria-pressed={rating >= value}
                  aria-label={`${value} estrella${value === 1 ? "" : "s"}`}
                  disabled={!canSubmit}
                  key={value}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>

          <label>
            Comentario
            <textarea
              value={comment}
              maxLength={300}
              onChange={(event) => setComment(event.target.value.slice(0, 300))}
              placeholder="Ej: Me explicó con paciencia y resolvimos ejercicios parecidos al parcial."
              disabled={!canSubmit}
            />
            <span className="request-counter">{comment.length}/300</span>
          </label>

          <button className="btn primary" type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "Enviando..." : "Enviar reseña"}
          </button>
        </form>
      </section>
    </main>
  );
}
