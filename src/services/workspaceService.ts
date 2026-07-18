import { apiFetch } from "@/lib/api";
import type { WorkspaceConfig } from "@/lib/types";

export const workspaceService = {
  async get(): Promise<WorkspaceConfig> {
    return apiFetch<WorkspaceConfig>("/workspace/");
  },
};
