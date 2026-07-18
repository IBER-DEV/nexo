import { apiFetch } from "@/lib/api";
import type { User, UserRole } from "@/lib/types";

export interface TeamMemberUpdate {
  coordinador_id?: number | null;
  rol?: UserRole;
  is_active?: boolean;
}

export const usersService = {
  async list(): Promise<User[]> {
    return apiFetch<User[]>("/users/");
  },

  async me(): Promise<User> {
    return apiFetch<User>("/users/me/");
  },

  async updateTeamMember(userId: number, changes: TeamMemberUpdate): Promise<User> {
    return apiFetch<User>(`/users/${userId}/`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
  },
};
