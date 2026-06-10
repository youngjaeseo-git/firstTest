import { z } from "zod";

export const CreateRoomElementSchema = z.object({
  roomId: z.string().trim().min(1, "Room ID is required"),
  type: z.enum(["COOLING", "PDU", "SWITCH", "MASTER_SERVER"]),
  name: z.string().trim().max(100).nullable().optional(),
  positionX: z.number().int().min(0).max(9999).optional().default(0),
  positionY: z.number().int().min(0).max(9999).optional().default(0),
  width: z.number().int().min(1).max(9999).nullable().optional(),
  height: z.number().int().min(1).max(9999).nullable().optional(),
  rotation: z.number().int().min(0).max(359).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
});

export const UpdateRoomElementSchema = z.object({
  name: z.string().trim().max(100).nullable().optional(),
  positionX: z.number().int().min(0).max(9999).optional(),
  positionY: z.number().int().min(0).max(9999).optional(),
  width: z.number().int().min(1).max(9999).nullable().optional(),
  height: z.number().int().min(1).max(9999).nullable().optional(),
  rotation: z.number().int().min(0).max(359).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});
