export type Role = "estudiante" | "tutor";

export type Profile = {
  id: string;
  full_name: string | null;
  role: Role | string | null;
  carrera: string | null;
  semestre: number | null;
  avatar_url: string | null;
  whatsapp: string | null;
  bio: string | null;
  created_at: string | null;
};

export type Materia = {
  id: number;
  nombre: string | null;
  codigo: string | null;
};

export type Profesor = {
  id: number;
  nombre: string | null;
  materia_id: number | null;
};

export type TutorExperiencia = {
  id: number;
  tutor_id: string;
  materia_id: number | null;
  profesor_id: number | null;
  costo_hora: number | null;
  ayudante_catedra: boolean | null;
};

export type Disponibilidad = {
  id: number;
  tutor_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
};

export type SolicitudEstado =
  | "pendiente"
  | "aceptada"
  | "rechazada"
  | "cancelada"
  | "vencida"
  | "finalizada";

export type Solicitud = {
  id: number;
  estudiante_id: string;
  tutor_id: string;
  materia_id: number | null;
  fecha_reunion: string;
  estado: SolicitudEstado | string;
  cancelada_por: string | null;
  motivo_cancelacion: string | null;
  created_at: string | null;
  expira_at: string | null;
};

export type Resena = {
  id: number;
  solicitud_id: number;
  estudiante_id: string;
  tutor_id: string;
  calificacion: number;
  comentario: string | null;
  created_at: string | null;
};

export type TutorCardData = {
  profile: Profile;
  experiencias: TutorExperiencia[];
  disponibilidad: Disponibilidad[];
  promedio: number | null;
  resenasCount: number;
};
