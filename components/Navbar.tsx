"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpen, CalendarDays, LayoutDashboard, LogOut, Search, UserRound, X } from "lucide-react";
import { getCurrentProfile, signOut } from "@/lib/data";
import type { Profile } from "@/lib/types";

export function Navbar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    getCurrentProfile().then(({ profile }) => setProfile(profile));
  }, []);

  useEffect(() => {
    if (!confirmSignOut) return;
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !signingOut) closeSignOutModal();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmSignOut, signingOut]);

  function closeSignOutModal() {
    setConfirmSignOut(false);
    setError("");
    setMessage("");
  }

  async function handleSignOutConfirmed() {
    setSigningOut(true);
    setError("");
    const { error } = await signOut();
    if (error) {
      setSigningOut(false);
      setError("No se pudo cerrar sesión. Intenta nuevamente.");
      return;
    }
    setMessage("Sesión cerrada correctamente.");
    await new Promise((resolve) => setTimeout(resolve, 700));
    window.location.href = "/";
  }

  const hideTutorsLink = pathname.startsWith("/tutor/") && pathname !== "/tutor/dashboard" && pathname !== "/tutor/perfil";

  return (
    <header className="nav-wrap">
      <nav className="nav" aria-label="Navegación principal">
        <Link href="/" className="brand" aria-label="StudySync inicio">
          <span className="brand-mark">
            <BookOpen size={22} aria-hidden="true" />
          </span>
          <span>StudySync</span>
        </Link>
        <div className="nav-links">
          {!hideTutorsLink && (
            <Link href="/tutores">
              <Search size={18} aria-hidden="true" /> Tutores
            </Link>
          )}
          {profile?.role === "estudiante" && (
            <Link href="/mis-solicitudes">
              <BookOpen size={18} aria-hidden="true" /> Mis solicitudes
            </Link>
          )}
          {profile?.role === "tutor" && (
            <>
              <Link href="/tutor/dashboard">
                <LayoutDashboard size={18} aria-hidden="true" /> Dashboard
              </Link>
              <Link href="/panel/disponibilidad">
                <CalendarDays size={18} aria-hidden="true" /> Disponibilidad
              </Link>
            </>
          )}
        </div>
        {profile && (
          <div className="nav-actions">
            <Link href={profile.role === "tutor" ? "/tutor/perfil" : "/mis-solicitudes"} className="icon-link">
              <UserRound size={18} aria-hidden="true" />
              <span>{profile.full_name ?? "Perfil"}</span>
            </Link>
            <button className="logout-button" onClick={() => setConfirmSignOut(true)} aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </nav>
      {confirmSignOut && (
        <div className="signout-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="signout-title">
          <section className="signout-modal">
            <button className="signout-close" type="button" onClick={closeSignOutModal} disabled={signingOut} aria-label="Cerrar modal" ref={closeButtonRef}>
              <X size={18} aria-hidden="true" />
            </button>
            <div className="signout-icon" aria-hidden="true">
              <LogOut size={24} />
            </div>
            <h2 id="signout-title">¿Seguro que deseas cerrar sesión?</h2>
            <p>Tu sesión actual se cerrará y tendrás que volver a iniciar sesión para continuar.</p>
            {error && (
              <p className="signout-error" aria-live="assertive">
                {error}
              </p>
            )}
            {message && (
              <p className="signout-success" aria-live="polite">
                {message}
              </p>
            )}
            <div className="signout-actions">
              <button type="button" className="btn subtle" onClick={closeSignOutModal} disabled={signingOut}>
                Cancelar
              </button>
              <button type="button" className="btn danger" onClick={handleSignOutConfirmed} disabled={signingOut}>
                {signingOut ? "Cerrando..." : "Cerrar sesión"}
              </button>
            </div>
          </section>
        </div>
      )}
    </header>
  );
}
