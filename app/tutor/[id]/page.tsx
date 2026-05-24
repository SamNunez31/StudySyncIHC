"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, DollarSign, Star, X } from "lucide-react";
import { Rating } from "@/components/StatusBadge";
import { days, getNextDateForDay, normalizeTime, timeSlots } from "@/lib/constants";
import { getCatalogs, getProfilesByIds, getTutorProfile } from "@/lib/data";
import { genericActionError, hasUnsafeContent, sanitizeText, unsafeInputError } from "@/lib/sanitize";
import { supabase } from "@/lib/supabase";
import type { Disponibilidad, Materia, Profesor, Profile, Resena, Solicitud, TutorExperiencia } from "@/lib/types";

type SlotOption = {
  key: string;
  disponibilidadId: number;
  day: number;
  start: string;
  end: string;
  date: Date;
};

const activeRequestStates = ["pendiente", "aceptada"];

export default function TutorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [experiencias, setExperiencias] = useState<TutorExperiencia[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad[]>([]);
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [reviewAuthors, setReviewAuthors] = useState<Profile[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMateriaId, setSelectedMateriaId] = useState("");
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalError, setModalError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Promise.all([getTutorProfile(id), getCatalogs()]).then(async ([tutor, catalogs]) => {
      setProfile(tutor.profile);
      setExperiencias(tutor.experiencias);
      setDisponibilidad(tutor.disponibilidad);
      setResenas(tutor.resenas);
      setReviewAuthors(await getProfilesByIds([...new Set(tutor.resenas.map((review) => review.estudiante_id))]));
      setSolicitudes(tutor.solicitudes);
      setMaterias(catalogs.materias);
      setProfesores(catalogs.profesores);
      setSelectedMateriaId(String(tutor.experiencias[0]?.materia_id ?? ""));
      setError(tutor.error || catalogs.error ? genericActionError : "");
    });
  }, [id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user?.id ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const promedio = resenas.length
    ? resenas.reduce((sum, review) => sum + review.calificacion, 0) / resenas.length
    : null;

  const mainCost = useMemo(() => {
    const costs = experiencias.map((item) => Number(item.costo_hora ?? 0)).filter((cost) => cost > 0);
    return costs.length ? Math.min(...costs) : null;
  }, [experiencias]);

  const slotOptions = useMemo(() => {
    return disponibilidad
      .flatMap((item) => splitAvailabilityIntoHourlySlots(item))
      .filter((slot) => !isSlotOccupied(slot, solicitudes))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 10);
  }, [disponibilidad, solicitudes]);

  const groupedSlotOptions = useMemo(() => {
    const groups = new Map<string, { label: string; slots: SlotOption[] }>();
    slotOptions.forEach((slot) => {
      const key = slot.date.toDateString();
      const current = groups.get(key) ?? { label: formatSlotGroupDate(slot.date), slots: [] };
      current.slots.push(slot);
      groups.set(key, current);
    });
    return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }));
  }, [slotOptions]);

  const selectedSlot = slotOptions.find((slot) => slot.key === selectedSlotKey) ?? null;
  const selectedExperience = experiencias.find((item) => String(item.materia_id) === selectedMateriaId) ?? null;
  const canConfirm = Boolean(currentUserId && selectedExperience?.materia_id && selectedSlot && !sending);

  function materiaName(itemId: number | null) {
    return materias.find((item) => item.id === itemId)?.nombre ?? "Materia";
  }

  function materiaCode(itemId: number | null) {
    return materias.find((item) => item.id === itemId)?.codigo ?? "";
  }

  function profesorName(itemId: number | null) {
    return profesores.find((item) => item.id === itemId)?.nombre ?? "Profesor";
  }

  function studentName(studentId: string) {
    return reviewAuthors.find((author) => author.id === studentId)?.full_name ?? "Estudiante";
  }

  function initials(name: string | null) {
    return (name ?? "Tutor")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  async function refreshBusyRequests() {
    const { data, error } = await supabase
      .from("solicitudes")
      .select("*")
      .eq("tutor_id", id)
      .in("estado", activeRequestStates);
    if (!error) setSolicitudes((data ?? []) as Solicitud[]);
    return (data ?? []) as Solicitud[];
  }

  async function openRequestModal() {
    setModalOpen(true);
    setSelectedSlotKey("");
    setRequestMessage("");
    setModalError("");
    await refreshBusyRequests();
    setModalMessage(currentUserId ? "" : "Inicia sesión para solicitar una tutoría.");
  }

  function closeRequestModal() {
    if (sending) return;
    setModalOpen(false);
    setModalError("");
    setModalMessage("");
  }

  async function submitRequest() {
    setModalError("");
    setModalMessage("");
    if (!currentUserId) {
      setModalError("Inicia sesión para solicitar una tutoría.");
      return;
    }
    if (!selectedExperience?.materia_id) {
      setModalError("Selecciona una materia.");
      return;
    }
    if (!selectedSlot) {
      setModalError("Selecciona un horario disponible.");
      return;
    }
    if (selectedExperience.tutor_id !== id || !slotOptions.some((slot) => slot.key === selectedSlot.key)) {
      setModalError("Este horario no está disponible.");
      return;
    }
    const latestBusyRequests = await refreshBusyRequests();
    if (isSlotOccupied(selectedSlot, latestBusyRequests)) {
      setSelectedSlotKey("");
      setModalError("Este horario acaba de ser reservado. Selecciona otro horario.");
      return;
    }
    if (hasUnsafeContent(requestMessage)) {
      setModalError(unsafeInputError);
      return;
    }
    const cleanMessage = sanitizeText(requestMessage, 500);
    if (requestMessage.trim() && !cleanMessage) {
      setModalError(unsafeInputError);
      return;
    }

    setSending(true);
    const expiraAt = new Date();
    expiraAt.setHours(expiraAt.getHours() + 48);
    const { error: insertError } = await supabase.from("solicitudes").insert({
      estudiante_id: currentUserId,
      tutor_id: id,
      materia_id: selectedExperience.materia_id,
      fecha_reunion: selectedSlot.date.toISOString(),
      estado: "pendiente",
      expira_at: expiraAt.toISOString(),
      mensaje: requestMessage.trim() || null
    });
    setSending(false);
    if (insertError) {
      setModalError("No se pudo enviar la solicitud. Intenta nuevamente.");
      return;
    }
    setModalMessage("Solicitud enviada correctamente.");
    window.setTimeout(() => router.replace("/mis-solicitudes?sent=1"), 1000);
  }

  if (error) return <main className="page"><p className="error">{error}</p></main>;
  if (!profile) return <main className="page"><p>Cargando perfil...</p></main>;

  return (
    <main className="tutor-profile-page">
      <Link className="tutor-back-link" href="/tutores">
        ← Volver a tutores
      </Link>

      <section className="tutor-profile-hero">
        <div className="tutor-profile-identity">
          <div className="tutor-profile-avatar" role="img" aria-label={`Avatar de ${profile.full_name ?? "tutor"}`}>
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={`Foto de perfil de ${profile.full_name ?? "tutor"}`} />
            ) : (
              initials(profile.full_name)
            )}
          </div>
          <div>
            <h1>{profile.full_name ?? "Tutor StudySync"}</h1>
            <p>{profile.carrera ?? "Carrera no registrada"} • Semestre {profile.semestre ?? "-"}</p>
            <div className="tutor-profile-meta">
              <span><Star size={16} aria-hidden="true" /> {promedio ? promedio.toFixed(1) : "Nuevo"}</span>
              <span><DollarSign size={16} aria-hidden="true" /> {mainCost ? `${mainCost}/h` : "A convenir"}</span>
            </div>
          </div>
        </div>
        <button className="btn primary tutor-profile-cta" type="button" onClick={openRequestModal}>
          Solicitar tutoría
        </button>
      </section>

      <section className="tutor-profile-grid">
        <article className="tutor-info-card">
          <h2>Sobre mí</h2>
          <p>{profile.bio || "Este tutor aún no ha agregado una descripción."}</p>
        </article>

        <article className="tutor-info-card">
          <h2>Materias y profesores</h2>
          <div className="tutor-subject-list">
            {experiencias.length === 0 ? (
              <p>Este tutor aún no ha registrado materias.</p>
            ) : (
              experiencias.map((exp) => (
                <div className="tutor-subject-row" key={exp.id}>
                  <div>
                    <strong>{materiaName(exp.materia_id)}</strong>
                    {materiaCode(exp.materia_id) && <span>{materiaCode(exp.materia_id)}</span>}
                    <p>Prof: {profesorName(exp.profesor_id)}</p>
                  </div>
                  <div className="tutor-subject-price">
                    <strong>${Number(exp.costo_hora ?? 0)}/h</strong>
                    {exp.ayudante_catedra && <span>Ayudante</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="tutor-info-card">
          <div className="tutor-card-title">
            <h2>Disponibilidad semanal</h2>
            <CalendarDays size={20} aria-hidden="true" />
          </div>
          <ProfileAvailabilityCalendar disponibilidad={disponibilidad} />
        </article>

        <article className="tutor-info-card" style={{ gridColumn: "1 / -1" }}>
          <h2>Reseñas</h2>
          {resenas.length === 0 ? (
            <p>No hay reseñas todavía para este tutor.</p>
          ) : (
            <div className="tutor-review-list">
              <Rating value={promedio} count={resenas.length} />
              {resenas.map((review) => (
                <div className="tutor-review" key={review.id}>
                  <strong>★ {review.calificacion}/5</strong>
                  <b>{studentName(review.estudiante_id)}</b>
                  <p>{review.comentario}</p>
                  {review.created_at && <span>{new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(new Date(review.created_at))}</span>}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      {modalOpen && (
        <div className="request-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="request-title" aria-describedby="request-description">
          <section className="request-modal">
            <p id="request-description" className="sr-only">Selecciona la materia, el horario y envía un mensaje opcional.</p>
            <button className="request-modal-close" type="button" onClick={closeRequestModal} aria-label="Cerrar modal">
              <X size={20} aria-hidden="true" />
            </button>
            <div className="request-modal-heading">
              <h2 id="request-title">Solicitar tutoría con {profile.full_name ?? "este tutor"}</h2>
              <p>Selecciona la materia, el horario y envía un mensaje opcional.</p>
            </div>

            {!currentUserId && (
              <div className="request-login-notice" aria-live="polite">
                <span>Inicia sesión para solicitar una tutoría.</span>
              </div>
            )}

            <label className="request-field">
              Materia
              <select value={selectedMateriaId} onChange={(event) => setSelectedMateriaId(event.target.value)}>
                {experiencias.map((exp) => (
                  <option value={exp.materia_id ?? ""} key={exp.id}>
                    {materiaName(exp.materia_id)} — {profesorName(exp.profesor_id)}
                  </option>
                ))}
              </select>
            </label>

            <section className="request-field">
              <span>Horario disponible</span>
              {slotOptions.length === 0 ? (
                <p className="tutor-muted">No hay horarios disponibles por ahora.</p>
              ) : (
                <div className="request-slot-grid" role="list">
                  {groupedSlotOptions.map((group) => (
                    <div className="request-slot-day-group" role="listitem" key={group.key}>
                      <h3 className="request-slot-day-title">{group.label}</h3>
                      <div className="request-slot-buttons">
                        {group.slots.map((slot) => {
                          const selected = selectedSlotKey === slot.key;
                          return (
                            <button
                              className={`request-slot-card ${selected ? "selected" : ""}`}
                              type="button"
                              onClick={() => setSelectedSlotKey(slot.key)}
                              aria-pressed={selected}
                              aria-selected={selected}
                              aria-label={`Seleccionar ${group.label} de ${slot.start} a ${slot.end}`}
                              key={slot.key}
                            >
                              <small>{slot.start} → {slot.end}</small>
                              {selected && <em><Check size={14} aria-hidden="true" /> Seleccionado</em>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <label className="request-field">
              Mensaje para el tutor (opcional)
              <textarea
                value={requestMessage}
                maxLength={500}
                onChange={(event) => setRequestMessage(event.target.value.slice(0, 500))}
                placeholder="Ej: Tengo dudas sobre el tema de elasticidad y necesito preparar el parcial."
              />
              <span className="request-counter">{requestMessage.length}/500</span>
            </label>

            {modalError && <p className="request-error" role="alert" aria-live="assertive">{modalError}</p>}
            {modalMessage && currentUserId && <p className="request-success" aria-live="polite">{modalMessage}</p>}

            {!currentUserId && (
              <button className="btn subtle" type="button" onClick={() => router.push(`/login?redirect=/tutor/${id}`)}>
                Iniciar sesión
              </button>
            )}

            <div className="request-actions">
              <button className="btn subtle" type="button" onClick={closeRequestModal}>
                Cancelar
              </button>
              <button className="btn primary" type="button" disabled={!canConfirm} onClick={submitRequest}>
                {sending ? "Enviando..." : "Confirmar solicitud"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function isSlotOccupied(slot: SlotOption, solicitudes: Solicitud[]) {
  return solicitudes.some((solicitud) => {
    if (!activeRequestStates.includes(String(solicitud.estado))) return false;
    const date = new Date(solicitud.fecha_reunion);
    return date.toDateString() === slot.date.toDateString() && normalizeDateTime(date) === normalizeDateTime(slot.date);
  });
}

function normalizeDateTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function splitAvailabilityIntoHourlySlots(item: Disponibilidad): SlotOption[] {
  const slots: SlotOption[] = [];
  const start = normalizeTime(item.hora_inicio);
  const end = normalizeTime(item.hora_fin);
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  let startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  while (startMinutes + 60 <= endMinutes) {
    const slotStart = minutesToTime(startMinutes);
    const slotEnd = minutesToTime(startMinutes + 60);
    const date = getNextDateForDay(item.dia_semana, slotStart);
    slots.push({
      key: `${item.id}-${slotStart}-${date.toISOString()}`,
      disponibilidadId: item.id,
      day: item.dia_semana,
      start: slotStart,
      end: slotEnd,
      date
    });
    startMinutes += 60;
  }

  return slots;
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function ProfileAvailabilityCalendar({ disponibilidad }: { disponibilidad: Disponibilidad[] }) {
  const availableKeys = useMemo(() => {
    const keys = new Set<string>();
    disponibilidad.forEach((item) => {
      const start = normalizeTime(item.hora_inicio);
      const end = normalizeTime(item.hora_fin);
      // Expandir franja en slots de 1 hora
      let [h] = start.split(":").map(Number);
      const [endH] = end.split(":").map(Number);
      while (h < endH) {
        const slotStart = `${String(h).padStart(2, "0")}:00`;
        const slotEnd = `${String(h + 1).padStart(2, "0")}:00`;
        keys.add(`${item.dia_semana}-${slotStart}-${slotEnd}`);
        h++;
      }
    });
    return keys;
  }, [disponibilidad]);
  const visibleTimeSlots = timeSlots.filter((slot) => days.some((day) => availableKeys.has(`${day.value}-${slot.start}-${slot.end}`)));

  return (
    <div className="profile-calendar" role="grid" aria-label="Disponibilidad semanal del tutor">
      <div className="profile-calendar-head">Hora</div>
      {days.map((day) => (
        <div className="profile-calendar-head" key={day.value}>{day.label}</div>
      ))}
      {visibleTimeSlots.map((slot) => (
        <div className="profile-calendar-row" key={slot.label}>
          <div className="profile-calendar-time">{slot.label}</div>
          {days.map((day) => {
            const available = availableKeys.has(`${day.value}-${slot.start}-${slot.end}`);
            return (
              <div
                className={`profile-calendar-cell ${available ? "available" : ""}`}
                key={`${day.value}-${slot.start}`}
              >
                {available ? "Disponible" : "No disponible"}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function formatSlotDay(date: Date) {
  return new Intl.DateTimeFormat("es-EC", { weekday: "short" }).format(date).replace(".", "").toUpperCase();
}

function formatSlotDate(date: Date) {
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short" }).format(date).replace(".", "");
}

function formatSlotGroupDate(date: Date) {
  const label = new Intl.DateTimeFormat("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
