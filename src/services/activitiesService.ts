import { apiFetch } from "@/lib/api";
import type { Activity, ActivityInput, ActivityMetaOptions } from "@/lib/types";

export const activitiesService = {
  async list(): Promise<Activity[]> {
    const res = await apiFetch<{ results: Activity[] } | Activity[]>("/activities/");
    // DRF paginated response wraps in `results`; handle both shapes
    return Array.isArray(res) ? res : res.results;
  },

  async create(input: ActivityInput): Promise<Activity> {
    return apiFetch<Activity>("/activities/", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async update(pk: number, patch: Partial<ActivityInput>): Promise<Activity> {
    return apiFetch<Activity>(`/activities/${pk}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async remove(pk: number): Promise<void> {
    return apiFetch<void>(`/activities/${pk}/`, { method: "DELETE" });
  },

  async meta(): Promise<ActivityMetaOptions> {
    return apiFetch<ActivityMetaOptions>("/activities/meta/");
  },

  async listByPlan(params: {
    mes_planeacion: string;
    semana_planeacion?: number;
  }): Promise<Activity[]> {
    const search = new URLSearchParams({ mes_planeacion: params.mes_planeacion });
    if (params.semana_planeacion) search.set("semana_planeacion", String(params.semana_planeacion));
    const res = await apiFetch<{ results: Activity[] } | Activity[]>(
      `/activities/?${search.toString()}`,
    );
    return Array.isArray(res) ? res : res.results;
  },

  async importExcel(
    file: File,
    params: { mes_planeacion?: string; semana_planeacion?: number },
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; error: unknown }>;
    dry_run: boolean;
  }> {
    const form = new FormData();
    form.append("file", file);
    if (params.mes_planeacion) form.append("mes_planeacion", params.mes_planeacion);
    if (params.semana_planeacion)
      form.append("semana_planeacion", String(params.semana_planeacion));

    return apiFetch("/activities/import/", {
      method: "POST",
      body: form,
    });
  },
};
