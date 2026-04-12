import { vi } from "vitest";

export const prisma = {
  equipment: {
    findMany: vi.fn(),
  },
  room: {
    findMany: vi.fn(),
  },
  rack: {
    findMany: vi.fn(),
  },
  alert: {
    findMany: vi.fn(),
  },
};
