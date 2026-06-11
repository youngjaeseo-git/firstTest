import { z } from "zod";

export const CreateRackSchema = z.object({
  name: z.string().trim().min(1, "Rack name is required").max(100),
  roomId: z.string().trim().min(1, "Room ID is required"),
  rowLabel: z.string().trim().max(10).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
  totalUnits: z.number().int().min(1).max(100).optional().default(42),
  maxPowerWatts: z.number().int().min(0).max(1000000).nullable().optional(),
  positionX: z.number().int().min(0).max(9999).nullable().optional(),
  positionY: z.number().int().min(0).max(9999).nullable().optional(),
  width: z.number().int().min(10).max(500).nullable().optional(),
  height: z.number().int().min(4).max(500).nullable().optional(),
});

export const UpdateRackSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  roomId: z.string().trim().min(1).optional(),
  rowLabel: z.string().trim().max(10).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  totalUnits: z.number().int().min(1).max(100).optional(),
  maxPowerWatts: z.number().int().min(0).max(1000000).nullable().optional(),
  positionX: z.number().int().min(0).max(9999).nullable().optional(),
  positionY: z.number().int().min(0).max(9999).nullable().optional(),
  width: z.number().int().min(10).max(500).nullable().optional(),
  height: z.number().int().min(4).max(500).nullable().optional(),
});
