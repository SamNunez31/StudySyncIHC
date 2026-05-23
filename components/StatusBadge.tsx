import type { SolicitudEstado } from "@/lib/types";

const labels: Record<string, string> = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
  vencida: "Vencida",
  finalizada: "Finalizada"
};

export function StatusBadge({ status }: { status: SolicitudEstado | string }) {
  return <span className={`status ${status}`}>{labels[status] ?? status}</span>;
}

export function Rating({ value, count }: { value: number | null; count?: number }) {
  if (!value) return <span className="muted">Sin resenas todavia</span>;
  return (
    <span className="rating" aria-label={`Calificacion ${value.toFixed(1)} de 5`}>
      ★ {value.toFixed(1)} {typeof count === "number" ? `(${count})` : ""}
    </span>
  );
}
