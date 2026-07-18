import { apiFetch } from "@/lib/api";
import type {
  ActivityType,
  Catalog,
  OrganizationDetail,
  Priority,
  WorkflowState,
} from "@/lib/types";

function crudFor<T extends { id: number }>(path: string) {
  return {
    list: () => apiFetch<T[]>(`${path}/`),
    create: (input: Record<string, unknown>) =>
      apiFetch<T>(`${path}/`, { method: "POST", body: JSON.stringify(input) }),
    update: (id: number, patch: Record<string, unknown>) =>
      apiFetch<T>(`${path}/${id}/`, { method: "PATCH", body: JSON.stringify(patch) }),
    remove: (id: number) => apiFetch<void>(`${path}/${id}/`, { method: "DELETE" }),
  };
}

function reorderable<T extends { id: number }>(path: string) {
  return {
    ...crudFor<T>(path),
    reorder: (ids: number[]) =>
      apiFetch<T[]>(`${path}/reorder/`, { method: "POST", body: JSON.stringify({ ids }) }),
  };
}

export const mastersService = {
  clientes: crudFor<Catalog>("/clientes"),
  procesos: crudFor<Catalog>("/procesos"),
  aplicaciones: crudFor<Catalog>("/aplicaciones"),
  stakeholders: crudFor<Catalog>("/stakeholders"),
  activityTypes: crudFor<ActivityType>("/activity-types"),
  priorities: reorderable<Priority>("/priorities"),
  workflowStates: reorderable<WorkflowState>("/workflow-states"),
  organization: {
    get: () => apiFetch<OrganizationDetail>("/organization/"),
    update: (patch: Partial<Omit<OrganizationDetail, "id" | "slug" | "plan">>) =>
      apiFetch<OrganizationDetail>("/organization/", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
  },
};

// Paleta curada: los mismos valores que ya usan los tokens de estado,
// prioridad y gráficas (validados en claro y oscuro) — evita hex libre.
export const MASTER_COLOR_PRESETS = [
  "#7C8A93",
  "#29AFF5",
  "#8C5CF2",
  "#F0A93B",
  "#22B573",
  "#5B6EF5",
  "#E5484D",
];
