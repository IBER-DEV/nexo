import { apiFetch } from "@/lib/api";
import type {
  Activity,
  ActivityDefaults,
  Project,
  ProjectInput,
  ProjectSummary,
} from "@/lib/types";

function unwrap<T>(res: { results: T[] } | T[]): T[] {
  // DRF pagina envolviendo en `results`; ambas formas llegan según el
  // endpoint, igual que en activitiesService.
  return Array.isArray(res) ? res : res.results;
}

export const projectsService = {
  async list(): Promise<Project[]> {
    return unwrap(await apiFetch<{ results: Project[] } | Project[]>("/projects/"));
  },

  async get(pk: number): Promise<Project> {
    return apiFetch<Project>(`/projects/${pk}/`);
  },

  async create(input: ProjectInput): Promise<Project> {
    return apiFetch<Project>("/projects/", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async update(pk: number, patch: Partial<ProjectInput>): Promise<Project> {
    return apiFetch<Project>(`/projects/${pk}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async remove(pk: number): Promise<void> {
    return apiFetch<void>(`/projects/${pk}/`, { method: "DELETE" });
  },

  /** Las actividades del proyecto que el usuario puede ver. Ojo: esta lista
   *  sí respeta el scoping por rol, a diferencia de `metrics`, que siempre
   *  es del proyecto entero. */
  async activities(pk: number): Promise<Activity[]> {
    return apiFetch<Activity[]>(`/projects/${pk}/activities/`);
  },

  async summary(): Promise<ProjectSummary> {
    return apiFetch<ProjectSummary>("/projects/summary/");
  },

  /** Contexto de la última actividad del proyecto, para prellenar la
   *  siguiente. `{}` si no hay ninguna visible. */
  async activityDefaults(pk: number): Promise<ActivityDefaults> {
    return apiFetch<ActivityDefaults>(`/projects/${pk}/activity-defaults/`);
  },
};
