import { apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";

export const usersService = {
  async list(): Promise<User[]> {
    return apiFetch<User[]>("/users/");
  },

  async me(): Promise<User> {
    return apiFetch<User>("/users/me/");
  },

  async assignCoordinator(userId: number, coordinador_id: number | null): Promise<User> {
    return apiFetch<User>(`/users/${userId}/`, {
      method: "PATCH",
      body: JSON.stringify({ coordinador_id }),
    });
  },
};
