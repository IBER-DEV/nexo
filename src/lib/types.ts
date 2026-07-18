export type WorkflowCategoria = "todo" | "active" | "done" | "cancelled";

export interface WorkflowState {
  id: number;
  nombre: string;
  slug: string;
  color: string;
  orden: number;
  categoria: WorkflowCategoria;
  is_initial: boolean;
  mostrar_en_kanban: boolean;
  sheet_phase: string;
  is_active: boolean;
}

export interface Priority {
  id: number;
  nombre: string;
  slug: string;
  color: string;
  orden: number;
  is_default: boolean;
  is_active: boolean;
}

export interface ActivityType {
  id: number;
  nombre: string;
  slug: string;
  color: string;
  orden: number;
  is_active: boolean;
}

export interface WorkspaceOrganization {
  id: number;
  nombre: string;
  slug: string;
  codigo_prefix: string;
  timezone: string;
  locale: string;
  currency: string;
}

/** Payload completo de GET/PATCH /api/v1/organization/ (solo admin). */
export interface OrganizationDetail extends WorkspaceOrganization {
  plan: string;
  appsheet_spreadsheet_id: string;
  appsheet_worksheet_name: string;
}

/** Catálogo simple con dueño (Cliente, Proceso, Aplicación, Stakeholder). */
export interface Catalog {
  id: number;
  nombre: string;
  is_active: boolean;
}

export interface WorkspaceConfig {
  organization: WorkspaceOrganization | null;
  workflow_states: WorkflowState[];
  priorities: Priority[];
  activity_types: ActivityType[];
  version: string;
  schema_version: number;
}

export interface Activity {
  pk: number;
  id: string; // "ACT-0001" — display only
  empresa: string;
  proceso: string;
  aplicacion: string;
  nombre: string;
  descripcion: string;
  responsable: string; // nombre del usuario — display only
  responsable_id: number; // PK del usuario — usado en formularios
  stakeholder: string;
  mes_planeacion: string | null; // YYYY-MM
  semana_planeacion: number | null; // 1-5
  prioridad_id: number;
  estado_id: number;
  tipo_id: number | null;
  fechaInicio: string; // ISO date
  fechaLimite: string; // ISO date
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
  prioridad_id: number;
  estado_id: number;
  tipo_id?: number | null;
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
