"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function AccessDenied() {
  return (
    <main className="center-shell">
      <section className="state-card" aria-live="polite">
        <ShieldAlert aria-hidden="true" />
        <h1>Acceso no permitido</h1>
        <p>Tu perfil no tiene permisos para ver esta pantalla.</p>
        <Link className="btn primary" href="/">
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}

export function LoadingState({ label = "Cargando informacion..." }: { label?: string }) {
  return (
    <main className="center-shell" aria-live="polite">
      <div className="loader" />
      <p>{label}</p>
    </main>
  );
}
