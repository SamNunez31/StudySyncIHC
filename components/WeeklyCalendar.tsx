"use client";

import { days, getNextDateForDay, normalizeTime, timeSlots } from "@/lib/constants";
import type { Disponibilidad, Solicitud } from "@/lib/types";

type SelectedSlot = {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  fecha: Date;
};

type Props = {
  disponibilidad: Disponibilidad[];
  solicitudes?: Solicitud[];
  editable?: boolean;
  selectedKeys?: Set<string>;
  onToggle?: (day: number, start: string, end: string) => void;
  selectable?: boolean;
  selectedSlot?: SelectedSlot | null;
  onSelect?: (slot: SelectedSlot) => void;
};

function key(day: number, start: string) {
  return `${day}-${start}`;
}

function isOccupied(day: number, start: string, solicitudes: Solicitud[]) {
  return solicitudes.some((solicitud) => {
    const date = new Date(solicitud.fecha_reunion);
    const requestDay = date.getDay() === 0 ? 7 : date.getDay();
    const requestStart = date.toTimeString().slice(0, 5);
    return requestDay === day && requestStart === start && ["pendiente", "aceptada"].includes(solicitud.estado);
  });
}

export function WeeklyCalendar({
  disponibilidad,
  solicitudes = [],
  editable = false,
  selectedKeys,
  onToggle,
  selectable = false,
  selectedSlot,
  onSelect
}: Props) {
  const availableKeys =
    selectedKeys ??
    new Set(disponibilidad.map((item) => key(item.dia_semana, normalizeTime(item.hora_inicio))));

  function renderCell(day: number, start: string, end: string) {
    const available = availableKeys.has(key(day, start));
    const occupied = isOccupied(day, start, solicitudes);
    const selected = selectedSlot?.dia_semana === day && selectedSlot.hora_inicio === start;
    const className = [
      "calendar-cell",
      available ? "available" : "unavailable",
      occupied ? "occupied" : "",
      selected ? "selected" : ""
    ]
      .filter(Boolean)
      .join(" ");
    const label = occupied ? "Ocupado" : available ? "Disponible" : "No disponible";

    function handleClick() {
      if (editable && onToggle) onToggle(day, start, end);
      if (selectable && available && !occupied && onSelect) {
        onSelect({ dia_semana: day, hora_inicio: start, hora_fin: end, fecha: getNextDateForDay(day, start) });
      }
    }

    return (
      <button
        type="button"
        className={className}
        onClick={handleClick}
        disabled={!editable && (!selectable || !available || occupied)}
        aria-pressed={editable ? available : selected}
        aria-label={`${label}, ${start} a ${end}`}
      >
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className="calendar-shell">
      <div className="weekly-calendar" role="grid" aria-label="Calendario semanal">
        <div className="calendar-head time-head">Hora</div>
        {days.map((day) => (
          <div className="calendar-head" key={day.value}>
            {day.label}
          </div>
        ))}
        {timeSlots.map((slot) => (
          <div className="calendar-row" key={slot.start}>
            <div className="calendar-time">{slot.label}</div>
            {days.map((day) => (
              <div className="calendar-slot" key={`${day.value}-${slot.start}`}>
                {renderCell(day.value, slot.start, slot.end)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mobile-calendar">
        {days.map((day) => (
          <section className="day-card" key={day.value}>
            <h3>{day.label}</h3>
            <div className="day-slots">
              {timeSlots.map((slot) => (
                <div className="day-slot" key={slot.start}>
                  <span>{slot.label}</span>
                  {renderCell(day.value, slot.start, slot.end)}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
