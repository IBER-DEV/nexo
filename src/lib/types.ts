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

/** Ciclo de vida de un proyecto. Enum fijo del backend (Project.Estado), a
 *  diferencia de WorkflowState, que cada organización configura. */
export type ProjectEstado = "planned" | "active" | "on_hold" | "done" | "cancelled";

/** Semáforo derivado, nunca almacenado — lo calcula `projects/progress.py`
 *  en cada lectura a partir de las actividades del proyecto. */
export type ProjectSalud =
  | "sin_datos"
  | "sin_fecha"
  | "en_tiempo"
  | "en_riesgo"
  | "atrasado"
  | "cerrado";

export interface ProjectMetrics {
  total_actividades: number;
  actividades_finalizadas: number;
  actividades_canceladas: number;
  actividades_abiertas: number;
  actividades_vencidas: number;
  /** 0-100. Finalizadas sobre el total, sin contar las canceladas. */
  avance: number;
  salud: ProjectSalud;
  dias_restantes: number | null;
}

export interface Project {
  pk: number;
  id: string; // "ACT-P001" — display only
  nombre: string;
  descripcion: string;
  estado: ProjectEstado;
  estado_display: string;
  color: string;
  lider_id: number | null;
  lider_nombre: string;
  cliente: string;
  fecha_inicio: string | null;
  fecha_fin_estimada: string | null;
  fecha_fin_real: string | null;
  is_active: boolean;
  created_at: string;
  metrics: ProjectMetrics;
}

export interface ProjectInput {
  nombre: string;
  descripcion?: string;
  estado?: ProjectEstado;
  lider_id?: number | null;
  cliente?: string;
  fecha_inicio?: string | null;
  fecha_fin_estimada?: string | null;
  fecha_fin_real?: string | null;
  is_active?: boolean;
}

/** Contexto repetible de la última actividad visible de un proyecto, para
 *  prellenar la siguiente. Vacío (`{}`) si el proyecto no tiene ninguna que
 *  este usuario pueda ver. Deliberadamente no trae fechas, estado,
 *  prioridad ni responsable — ver `ProjectViewSet.activity_defaults`. */
export interface ActivityDefaults {
  empresa?: string;
  proceso?: string;
  aplicacion?: string;
  stakeholder?: string;
  tipo_id?: number | null;
}

export interface ProjectSummary {
  total: number;
  por_salud: Partial<Record<ProjectSalud, number>>;
  activos: number;
  avance_promedio: number;
}

export const PROJECT_ESTADO_LABEL: Record<ProjectEstado, string> = {
  planned: "Planificado",
  active: "En curso",
  on_hold: "En pausa",
  done: "Finalizado",
  cancelled: "Cancelado",
};

export const SALUD_LABEL: Record<ProjectSalud, string> = {
  sin_datos: "Sin actividades",
  sin_fecha: "Sin fecha de entrega",
  en_tiempo: "En tiempo",
  en_riesgo: "En riesgo",
  atrasado: "Atrasado",
  cerrado: "Cerrado",
};

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
  proyecto: string; // nombre — display only
  proyecto_id: number | null;
  proyecto_codigo: string; // "ACT-P001" — display only
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
  /** El backend acepta el proyecto por id (esta, la que usa la UI) o por
   *  nombre; si llegan las dos, gana el id. Ver ActivitySerializer. */
  proyecto_id?: number | null;
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

export type UserRole = "owner" | "admin" | "coordinator" | "member";

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol: UserRole;
  iniciales: string;
  coordinador_id?: number | null;
  coordinador_nombre?: string | null;
  email_verified: boolean;
  is_active: boolean;
  is_demo_readonly: boolean;
}

/** Código de acceso a la organización (Bloque C — ver ADR 0002). */
export interface AccessCode {
  id: number;
  codigo: string;
  rol: UserRole;
  expires_at: string | null;
  max_usos: number | null;
  usos: number;
  is_active: boolean;
  created_at: string;
  created_by_nombre: string | null;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Administrador",
  coordinator: "Coordinador",
  member: "Miembro",
};
