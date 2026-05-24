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
  const [hoverRating, setHoverRating] = useState(0);

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
    return () => { mounted = false; };
  }, [auth.userId, id]);

  if (auth.loading || loadingData) return <LoadingState />;
  if (auth.forbidden) return <AccessDenied />;

  const validStatus = solicitud ? ["aceptada", "finalizada"].includes(String(solicitud.estado)) : false;
  const canSubmit = Boolean(solicitud && validStatus && !existingReview);
  const activeRating = hoverRating || rating;
  const ratingLabels = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.userId || !solicitud || submitting) return;
    setError("");
    setSuccess("");
    if (!rating) { setError("Selecciona una calificación."); return; }
    if (!validStatus) { setError("Esta solicitud no está en un estado válido para reseñar."); return; }
    if (existingReview) { setError("Ya enviaste una reseña para esta tutoría."); return; }
    if (hasUnsafeContent(comment)) { setError(unsafeInputError); return; }
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
    if (insertError) { setError("No se pudo enviar la reseña. Intenta nuevamente."); return; }
    setExistingReview(true);
    setSuccess("¡Reseña enviada correctamente!");
    window.setTimeout(() => router.replace("/mis-solicitudes"), 900);
  }

  return (
    <main style={{
      minHeight: "calc(100vh - 76px)",
      display: "grid",
      placeItems: "center",
      padding: "2rem 1rem",
      background: "radial-gradient(circle at 20% 20%, rgba(73,50,220,0.08), transparent 40rem), linear-gradient(135deg, #f7f5ff 0%, #eef5ff 52%, #fbfdff 100%)"
    }}>
      <section style={{
        width: "min(680px, 100%)",
        padding: "2.5rem",
        border: "1px solid #EDE9FE",
        borderRadius: "24px",
        background: "rgba(255,255,255,0.98)",
        boxShadow: "0 24px 64px rgba(73,50,220,0.13)",
        display: "grid",
        gap: "1.5rem"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px",
              background: "linear-gradient(135deg, #4932dc, #7423d6)",
              display: "grid", placeItems: "center",
              color: "#fff", fontSize: "1.3rem", flexShrink: 0
            }}>★</div>
            <h1 style={{ margin: 0, fontSize: "clamp(1.6rem, 3vw, 2.2rem)", color: "#17132a", lineHeight: 1.1 }}>
              Agregar reseña
            </h1>
          </div>
          <p style={{ margin: 0, color: "#667085", fontSize: "0.95rem", lineHeight: 1.5 }}>
            Tu opinión ayuda a otros estudiantes a elegir mejor a su tutor.
          </p>
        </div>

        {existingReview && <p className="error">Ya enviaste una reseña para esta tutoría.</p>}
        {error && <p className="error" role="alert" aria-live="assertive">{error}</p>}
        {success && <p className="success" aria-live="polite">{success}</p>}

        <form style={{ display: "grid", gap: "1.25rem" }} onSubmit={submit}>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: "12px" }}>
            <legend style={{ color: "#17132a", fontWeight: 800, fontSize: "0.95rem" }}>
              Calificación <span style={{ color: "#EF4444", marginLeft: "2px" }}>*</span>
            </legend>
            <div style={{ display: "flex", gap: "10px" }}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  aria-pressed={rating >= value}
                  aria-label={`${value} estrella${value === 1 ? "" : "s"}`}
                  disabled={!canSubmit}
                  key={value}
                  style={{
                    width: "58px", height: "58px",
                    fontSize: "1.8rem",
                    border: activeRating >= value ? "2px solid #F59E0B" : "1.5px solid #E5E7EB",
                    borderRadius: "14px",
                    background: activeRating >= value ? "#FFFBEB" : "#F9FAFB",
                    color: activeRating >= value ? "#F59E0B" : "#D1D5DB",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    transition: "all 0.15s ease",
                    display: "grid", placeItems: "center",
                    transform: activeRating >= value ? "translateY(-2px)" : "none"
                  }}
                >
                  ★
                </button>
              ))}
            </div>
            {activeRating > 0 && (
              <p style={{ margin: 0, fontSize: "0.88rem", color: "#92400E", fontWeight: 700 }}>
                {ratingLabels[activeRating]} — {activeRating}/5
              </p>
            )}
          </fieldset>

          <label style={{ display: "grid", gap: "8px", color: "#17132a", fontWeight: 800, fontSize: "0.95rem" }}>
            Comentario <span style={{ color: "#9CA3AF", fontWeight: 500, fontSize: "0.85rem" }}>(opcional)</span>
            <textarea
              value={comment}
              maxLength={300}
              onChange={(event) => setComment(event.target.value.slice(0, 300))}
              placeholder="Ej: Me explicó con paciencia y resolvimos ejercicios parecidos al parcial."
              disabled={!canSubmit}
              style={{
                minHeight: "120px",
                border: "1.5px solid #DDD6FE",
                borderRadius: "14px",
                padding: "14px",
                fontSize: "0.95rem",
                resize: "vertical",
                fontFamily: "inherit",
                color: "#17132a",
                transition: "border-color 0.18s ease"
              }}
            />
            <span style={{ justifySelf: "end", color: "#9CA3AF", fontSize: "0.8rem" }}>
              {comment.length}/300
            </span>
          </label>

          <div style={{ display: "grid", gap: "10px" }}>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              style={{
                minHeight: "54px",
                border: 0,
                borderRadius: "14px",
                color: "#ffffff",
                background: canSubmit ? "linear-gradient(135deg, #4932dc, #7423d6)" : "#C4B5FD",
                boxShadow: canSubmit ? "0 16px 34px rgba(74,50,220,0.24)" : "none",
                cursor: canSubmit ? "pointer" : "not-allowed",
                fontWeight: 900,
                fontSize: "1rem",
                transition: "all 0.18s ease"
              }}
            >
              {submitting ? "Enviando..." : "Enviar reseña"}
            </button>
            <button
              type="button"
              onClick={() => router.replace("/mis-solicitudes")}
              style={{
                minHeight: "46px",
                border: 0,
                borderRadius: "14px",
                color: "#ffffff",
                background: "#b91c1c",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.95rem",
                transition: "all 0.18s ease"
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}