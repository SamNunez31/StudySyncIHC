"use client";

import { useEffect, useMemo, useState } from "react";
import { AccessDenied, LoadingState } from "@/components/AccessDenied";
import { WeeklyCalendar } from "@/components/WeeklyCalendar";
import { normalizeTime, timeSlots } from "@/lib/constants";
import { genericActionError } from "@/lib/sanitize";
import { supabase } from "@/lib/supabase";
import type { Disponibilidad } from "@/lib/types";
import { useAuthProfile } from "@/hooks/useAuthProfile";

function slotKey(day: number, start: string) {
  return `${day}-${start}`;
}

export default function AvailabilityPage() {
  const auth = useAuthProfile("tutor");
  const [items, setItems] = useState<Disponibilidad[]>([]);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.userId) return;
    supabase
      .from("disponibilidad")
      .select("*")
      .eq("tutor_id", auth.userId)
      .then(({ data, error }) => {
        const current = (data ?? []) as Disponibilidad[];
        setItems(current);
        setKeys(new Set(current.map((item) => slotKey(item.dia_semana, normalizeTime(item.hora_inicio)))));
        setError(error ? genericActionError : "");
      });
  }, [auth.userId]);

  const selectedItems = useMemo(() => {
    return Array.from(keys).map((value, index) => {
      const [day, start] = value.split("-");
      const slot = timeSlots.find((item) => item.start === start);
      return {
        id: index,
        tutor_id: auth.userId ?? "",
        dia_semana: Number(day),
        hora_inicio: start,
        hora_fin: slot?.end ?? "09:00"
      };
    });
  }, [auth.userId, keys]);

  if (auth.loading) return <LoadingState />;
  if (auth.forbidden) return <AccessDenied />;

  function toggle(day: number, start: string) {
    setKeys((current) => {
      const next = new Set(current);
      const key = slotKey(day, start);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (!auth.userId) return;
    setError("");
    setMessage("");
    const deleted = await supabase.from("disponibilidad").delete().eq("tutor_id", auth.userId);
    if (deleted.error) {
      setError(genericActionError);
      return;
    }
    const rows = selectedItems.map(({ dia_semana, hora_inicio, hora_fin }) => ({
      tutor_id: auth.userId,
      dia_semana,
      hora_inicio,
      hora_fin
    }));
    if (rows.length > 0) {
      const inserted = await supabase.from("disponibilidad").insert(rows);
      if (inserted.error) {
        setError(genericActionError);
        return;
      }
    }
    setItems(selectedItems);
    setMessage("Disponibilidad actualizada correctamente.");
  }

  return (
    <main className="page">
      <div className="stack">
        <span className="eyebrow">Panel tutor</span>
        <h1>Disponibilidad semanal</h1>
        <p>Marca o desmarca bloques. Lunes a sabado, en franjas de una hora.</p>
      </div>
      {message && <p className="success" aria-live="polite">{message}</p>}
      {error && <p className="error">{error}</p>}
      <section className="card">
        <WeeklyCalendar disponibilidad={items} editable selectedKeys={keys} onToggle={toggle} />
        <div className="card-actions" style={{ marginTop: 18 }}>
          <button className="btn primary" onClick={save}>Guardar disponibilidad</button>
        </div>
      </section>
    </main>
  );
}
