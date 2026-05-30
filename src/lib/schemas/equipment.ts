import { z } from "zod";

export const EQUIPMENT_TYPES = [
  "SERVER",
  "SWITCH",
  "ROUTER",
  "FIREWALL",
  "STORAGE",
  "PDU",
  "UPS",
  "PATCH_PANEL",
  "OTHER",
] as const;

export const EQUIPMENT_STATUSES = [
  "PLANNED",
  "RECEIVING",
  "INSTALLED",
  "ACTIVE",
  "MAINTENANCE",
  "REPAIR",
  "FAILED",
  "DECOMMISSIONED",
  "DISPOSED",
] as const;

export const MEMORY_TYPES = [
  "DDR3",
  "DDR4",
  "DDR5",
  "HBM",
  "HBM2",
  "HBM2E",
  "HBM3",
  "LPDDR4",
  "LPDDR5",
] as const;

export const CpuSchema = z.object({
  socketIndex: z.number().int().min(0).max(15).optional(),
  manufacturer: z.string().trim().max(100).nullable().optional(),
  model: z.string().trim().max(200).nullable().optional(),
  cores: z.number().int().min(0).max(4096).nullable().optional(),
  threads: z.number().int().min(0).max(8192).nullable().optional(),
  baseFreqMhz: z.number().int().min(0).max(100000).nullable().optional(),
  maxFreqMhz: z.number().int().min(0).max(100000).nullable().optional(),
  architecture: z.string().trim().max(50).nullable().optional(),
  tdpWatts: z.number().int().min(0).max(2000).nullable().optional(),
});

export const MemorySchema = z.object({
  slotName: z.string().trim().min(1).max(100),
  slotIndex: z.number().int().min(0).max(1023),
  populated: z.boolean().optional(),
  capacityGb: z.number().min(0).max(65536).nullable().optional(),
  memoryType: z.enum(MEMORY_TYPES).nullable().optional(),
  manufacturer: z.string().trim().max(100).nullable().optional(),
  partNumber: z.string().trim().max(200).nullable().optional(),
  serialNumber: z.string().trim().max(200).nullable().optional(),
  speedMhz: z.number().int().min(0).max(100000).nullable().optional(),
  currentSpeedMhz: z.number().int().min(0).max(100000).nullable().optional(),
  rank: z.number().int().min(0).max(8).nullable().optional(),
  eccEnabled: z.boolean().nullable().optional(),
  formFactor: z.string().trim().max(50).nullable().optional(),
  voltage: z.number().min(0).max(10).nullable().optional(),
});

/** Core Equipment columns (excludes nested cpus/memories and server-managed fields). */
export const EquipmentFieldsSchema = z.object({
  hostname: z.string().trim().max(255).nullable().optional(),
  ipAddress: z.string().trim().max(45).nullable().optional(),
  type: z.enum(EQUIPMENT_TYPES),
  manufacturer: z.string().trim().max(100).nullable().optional(),
  model: z.string().trim().max(200).nullable().optional(),
  serialNumber: z.string().trim().max(200).nullable().optional(),
  assetTag: z.string().trim().max(100).nullable().optional(),
  rackId: z.string().trim().max(50).nullable().optional(),
  rackPosition: z.number().int().min(0).max(100).nullable().optional(),
  rackHeight: z.number().int().min(1).max(60).optional(),
  status: z.enum(EQUIPMENT_STATUSES).optional(),
  osType: z.string().trim().max(50).nullable().optional(),
  osVersion: z.string().trim().max(100).nullable().optional(),
  biosVersion: z.string().trim().max(100).nullable().optional(),
  bmcIpAddress: z.string().trim().max(45).nullable().optional(),
  totalMemoryGB: z.number().int().min(0).max(1048576).nullable().optional(),
  purchaseDate: z.coerce.date().nullable().optional(),
  warrantyExpiry: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  prometheusInstance: z.string().trim().max(255).nullable().optional(),
});

/** Create: type required, optional nested cpus/memories arrays. */
export const CreateEquipmentSchema = EquipmentFieldsSchema.extend({
  cpus: z.array(CpuSchema).max(16).optional(),
  memories: z.array(MemorySchema).max(1024).optional(),
});

/** Update: all fields optional (partial), plus optional nested arrays. */
export const UpdateEquipmentSchema = EquipmentFieldsSchema.partial().extend({
  cpus: z.array(CpuSchema).max(16).optional(),
  memories: z.array(MemorySchema).max(1024).optional(),
});
