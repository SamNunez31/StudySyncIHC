"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, LogIn } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";

export default function Home() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <main className="home-landing">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <span className="home-badge">
            <span aria-hidden="true">✦</span>
            Mentorías entre estudiantes universitarios
          </span>
          <h1 id="home-title">Aprende de quien ya pasó por ahí</h1>
          <p>
            Conecta con compañeros de semestres superiores que tomaron la misma materia con el mismo profesor.
          </p>
          <div className="home-hero-actions">
            <Link href="/tutores" className="home-hero-button">
              Empezar a buscar tutores
              <ArrowRight size={23} aria-hidden="true" />
            </Link>
            <button type="button" className="home-hero-secondary" onClick={() => setAuthOpen(true)}>
              <LogIn size={21} aria-hidden="true" />
              Iniciar sesión
            </button>
          </div>
        </div>

        <div className="home-hero-image" aria-label="Estudiantes universitarios estudiando juntos" />
      </section>

      {authOpen && (
        <div className="home-auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <AuthForm mode="login" embedded onClose={() => setAuthOpen(false)} />
        </div>
      )}
    </main>
  );
}
