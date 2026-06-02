import { z } from "zod";

export const CreateRoomSchema = z.object({
  name: z.string().trim().min(1, "Room name is required").max(100),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
  description: z.string().trim().max(2000).nullable().optional(),
});

export const UpdateRoomSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});
