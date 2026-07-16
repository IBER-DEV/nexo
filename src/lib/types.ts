export type ActivityStatus =
  | "backlog"
  | "in_progress"
  | "testing"
  | "pending_client"
  | "done"
  | "cancelled";

export type ActivityPriority = "low" | "medium" | "high" | "critical";

export interface Activity {
  pk: number;
  id: string;              // "ACT-0001" — display only
  empresa: string;
  proceso: string;
  aplicacion: string;
  nombre: string;
  descripcion: string;
  responsable: string;     // nombre del usuario — display only
  responsable_id: number;  // PK del usuario — usado en formularios
  stakeholder: string;
  mes_planeacion: string | null; // YYYY-MM
  semana_planeacion: number | null; // 1-5
  prioridad: ActivityPriority;
  estado: ActivityStatus;
  fechaInicio: string;     // ISO date
  fechaLimite: string;     // ISO date
}

export interface ActivityInput {
  empresa: string;
  proceso: string;
  aplicacion: string;
  nombre: string;
  descripcion: string;
  responsable_id: number;
  stakeholder: string;
  mes_planeacion: string;
  semana_planeacion: number;
  prioridad: ActivityPriority;
  estado: ActivityStatus;
  fechaInicio: string;
  fechaLimite: string;
}

export interface ActivityMetaOptions {
  empresas: string[];
  procesos: string[];
  aplicaciones: string[];
  stakeholders: string[];
}

export type UserRole = "admin" | "coordinator" | "member";

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol: UserRole;
  iniciales: string;
  coordinador_id?: number | null;
  coordinador_nombre?: string | null;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  coordinator: "Coordinador",
  member: "Miembro",
};

export const STATUS_LABEL: Record<ActivityStatus, string> = {
  backlog: "Backlog",
  in_progress: "En progreso",
  testing: "En pruebas",
  pending_client: "Pendiente cliente",
  done: "Finalizado",
  cancelled: "Cancelado",
};

export const PRIORITY_LABEL: Record<ActivityPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

export const STATUSES: ActivityStatus[] = [
  "backlog",
  "in_progress",
  "testing",
  "pending_client",
  "done",
  "cancelled",
];

export const PRIORITIES: ActivityPriority[] = ["low", "medium", "high", "critical"];
