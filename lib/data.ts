"use client";

import { supabase } from "@/lib/supabase";
import type {
  Disponibilidad,
  Materia,
  Profesor,
  Profile,
  Resena,
  Solicitud,
  TutorCardData,
  TutorExperiencia
} from "@/lib/types";

export async function getCurrentProfile() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { user: null, profile: null, error: userError };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single<Profile>();

  return { user: userData.user, profile, error };
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCatalogs() {
  const [materias, profesores] = await Promise.all([
    supabase.from("materias").select("*").order("nombre"),
    supabase.from("profesores").select("*").order("nombre")
  ]);

  return {
    materias: (materias.data ?? []) as Materia[],
    profesores: (profesores.data ?? []) as Profesor[],
    error: materias.error ?? profesores.error
  };
}

export async function getTutors() {
  const [profiles, experiencias, disponibilidad, resenas] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "tutor").order("full_name"),
    supabase.from("tutor_experiencia").select("*"),
    supabase.from("disponibilidad").select("*"),
    supabase.from("resenas").select("*")
  ]);

  const error = profiles.error ?? experiencias.error ?? disponibilidad.error ?? resenas.error;
  const reviews = (resenas.data ?? []) as Resena[];

  const tutors: TutorCardData[] = ((profiles.data ?? []) as Profile[]).map((profile) => {
    const tutorReviews = reviews.filter((review) => review.tutor_id === profile.id);
    const promedio =
      tutorReviews.length > 0
        ? tutorReviews.reduce((sum, review) => sum + review.calificacion, 0) / tutorReviews.length
        : null;

    return {
      profile,
      experiencias: ((experiencias.data ?? []) as TutorExperiencia[]).filter(
        (item) => item.tutor_id === profile.id
      ),
      disponibilidad: ((disponibilidad.data ?? []) as Disponibilidad[]).filter(
        (item) => item.tutor_id === profile.id
      ),
      promedio,
      resenasCount: tutorReviews.length
    };
  });

  return { tutors, error };
}

export async function getTutorProfile(tutorId: string) {
  const [profile, experiencias, disponibilidad, resenas, solicitudes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", tutorId).single<Profile>(),
    supabase.from("tutor_experiencia").select("*").eq("tutor_id", tutorId),
    supabase.from("disponibilidad").select("*").eq("tutor_id", tutorId),
    supabase.from("resenas").select("*").eq("tutor_id", tutorId).order("created_at", { ascending: false }),
    supabase
      .from("solicitudes")
      .select("*")
      .eq("tutor_id", tutorId)
      .in("estado", ["pendiente", "aceptada"])
  ]);

  return {
    profile: profile.data,
    experiencias: (experiencias.data ?? []) as TutorExperiencia[],
    disponibilidad: (disponibilidad.data ?? []) as Disponibilidad[],
    resenas: (resenas.data ?? []) as Resena[],
    solicitudes: (solicitudes.data ?? []) as Solicitud[],
    error: profile.error ?? experiencias.error ?? disponibilidad.error ?? resenas.error ?? solicitudes.error
  };
}

export async function getStudentRequests(studentId: string) {
  const { data, error } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("estudiante_id", studentId)
    .order("fecha_reunion", { ascending: false });

  return { solicitudes: (data ?? []) as Solicitud[], error };
}

export async function getTutorRequests(tutorId: string) {
  const { data, error } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("tutor_id", tutorId)
    .order("fecha_reunion", { ascending: true });

  return { solicitudes: (data ?? []) as Solicitud[], error };
}

export async function getProfilesByIds(ids: string[]) {
  if (ids.length === 0) return [] as Profile[];
  const { data } = await supabase.from("profiles").select("*").in("id", ids);
  return (data ?? []) as Profile[];
}
