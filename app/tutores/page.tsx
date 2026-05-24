"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, DollarSign, Search, Star } from "lucide-react";
import { getCatalogs, getTutors } from "@/lib/data";
import { genericActionError } from "@/lib/sanitize";
import type { Materia, Profesor, TutorCardData } from "@/lib/types";

export default function TutorsPage() {
  const [tutors, setTutors] = useState<TutorCardData[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [query, setQuery] = useState("");
  const [materia, setMateria] = useState("");
  const [profesor, setProfesor] = useState("");
  const [maxCost, setMaxCost] = useState("");
  const [minRating, setMinRating] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getTutors(), getCatalogs()]).then(([tutorData, catalogData]) => {
      setTutors(tutorData.tutors);
      setMaterias(catalogData.materias);
      setProfesores(catalogData.profesores);
      setError(tutorData.error || catalogData.error ? genericActionError : "");
    });
  }, []);

  function materiaName(id: number | null) {
    return materias.find((item) => item.id === id)?.nombre ?? "Materia";
  }

  function profesorName(id: number | null) {
    return profesores.find((item) => item.id === id)?.nombre ?? "Profesor";
  }

  const filtered = useMemo(() => {
    return tutors.filter((tutor) => {
      const experienceText = tutor.experiencias
        .map((item) => `${materiaName(item.materia_id)} ${profesorName(item.profesor_id)}`)
        .join(" ");
      const text = `${tutor.profile.full_name ?? ""} ${tutor.profile.carrera ?? ""} ${experienceText}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      const matchesMateria = !materia || tutor.experiencias.some((item) => String(item.materia_id) === materia);
      const matchesProfesor = !profesor || tutor.experiencias.some((item) => String(item.profesor_id) === profesor);
      const matchesCost =
        !maxCost || tutor.experiencias.some((item) => Number(item.costo_hora ?? 0) <= Number(maxCost));
      const matchesRating = !minRating || Number(tutor.promedio ?? 0) >= Number(minRating);
      return matchesQuery && matchesMateria && matchesProfesor && matchesCost && matchesRating;
    });
  }, [maxCost, materia, minRating, profesor, query, tutors, materias, profesores]);

  function initials(name: string | null) {
    return (name ?? "Tutor")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function minCost(tutor: TutorCardData) {
    const costs = tutor.experiencias.map((item) => Number(item.costo_hora ?? 0)).filter((cost) => cost > 0);
    return costs.length ? Math.min(...costs) : null;
  }

  function availabilityLabel(tutor: TutorCardData) {
    if (tutor.disponibilidad.length === 0) return "Sin disponibilidad registrada";
    const uniqueDays = [...new Set(tutor.disponibilidad.map((item) => item.dia_semana))];
    const dayNames: Record<number, string> = { 1: "Lun", 2: "Mar", 3: "Mie", 4: "Jue", 5: "Vie", 6: "Sab" };
    const visible = uniqueDays.slice(0, 2).map((day) => dayNames[day]).join(", ");
    const extra = uniqueDays.length > 2 ? ` +${uniqueDays.length - 2}` : "";
    return `Disponible: ${visible}${extra}`;
  }

  return (
    <main className="tutors-page">
      <header className="tutors-header">
        <div>
          <h1>Buscar tutores</h1>
          <p>Encuentra compañeros que ya cursaron tu materia con el mismo profesor.</p>
        </div>
        <span className="tutors-count">Se encontraron {filtered.length} tutores disponibles.</span>
      </header>

      <section className="tutors-filters" aria-label="Filtros de busqueda">
        <div className="tutors-filter-grid">
          <label>
            Buscar
            <span className="tutors-search-input">
              <Search size={17} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, carrera o materia..."
              />
            </span>
          </label>
          <label>
            Materia
            <select value={materia} onChange={(event) => setMateria(event.target.value)}>
              <option value="">Todas</option>
              {materias.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Profesor
            <select value={profesor} onChange={(event) => setProfesor(event.target.value)}>
              <option value="">Todos</option>
              {profesores.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Costo maximo
            <input type="number" min="0" value={maxCost} onChange={(event) => setMaxCost(event.target.value)} placeholder="$" />
          </label>
          <label>
            Calificacion
            <select value={minRating} onChange={(event) => setMinRating(event.target.value)}>
              <option value="">Todas</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
              <option value="4.5">4.5+</option>
            </select>
          </label>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {tutors.length === 0 ? (
        <section className="tutors-empty">
          <CalendarDays aria-hidden="true" />
          <h2>No hay tutores disponibles todavía</h2>
          <p>Cuando existan perfiles con rol tutor aparecerán aquí.</p>
        </section>
      ) : (
        <section className="tutors-list" aria-label="Resultados de tutores">
          {filtered.map((tutor) => (
            <Link
              className="tutor-row-card"
              href={`/tutor/${tutor.profile.id}`}
              aria-label={`Abrir ficha de ${tutor.profile.full_name ?? "tutor"}`}
              key={tutor.profile.id}
            >
              <div className="tutor-row-main">
                <div className="tutor-row-avatar" role="img" aria-label={`Avatar de ${tutor.profile.full_name ?? "tutor"}`}>
                  {tutor.profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tutor.profile.avatar_url} alt={`Foto de perfil de ${tutor.profile.full_name ?? "tutor"}`} />
                  ) : (
                    initials(tutor.profile.full_name)
                  )}
                </div>
                <div className="tutor-row-info">
                  <h2>{tutor.profile.full_name}</h2>
                  <p>{tutor.profile.carrera} · Sem. {tutor.profile.semestre ?? "-"}</p>
                  <div className="tutor-tags">
                    {tutor.experiencias.slice(0, 2).map((exp) => (
                      <span key={exp.id}>
                        {materiaName(exp.materia_id)} · {profesorName(exp.profesor_id)}
                      </span>
                    ))}
                    {tutor.experiencias.length > 2 && <span>+{tutor.experiencias.length - 2} mas</span>}
                  </div>
                  <span className="tutor-availability">
                    <CalendarDays size={15} aria-hidden="true" /> {availabilityLabel(tutor)}
                  </span>
                </div>
              </div>
              <aside className="tutor-row-side">
                <span className="tutor-rating">
                  <Star size={15} aria-hidden="true" /> {tutor.promedio ? tutor.promedio.toFixed(1) : "Nuevo"}
                </span>
                <span className="tutor-price">
                  <DollarSign size={15} aria-hidden="true" /> {minCost(tutor) ? `${minCost(tutor)}/h` : "A convenir"}
                </span>
              </aside>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
