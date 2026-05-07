import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || "";
  const cpuModel = searchParams.get("cpuModel") || "";
  const memoryType = searchParams.get("memoryType") || "";
  const memoryMfr = searchParams.get("memoryMfr") || "";
  const manufacturer = searchParams.get("manufacturer") || "";
  const model = searchParams.get("model") || "";
  const biosVersion = searchParams.get("biosVersion") || "";
  const status = searchParams.get("status") || "";
  const minMemoryGb = parseInt(searchParams.get("minMemoryGb") || "0") || 0;
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

  const where: Record<string, unknown> = {};
  const andConditions: Record<string, unknown>[] = [];

  if (q) {
    andConditions.push({
      OR: [
        { hostname: { contains: q, mode: "insensitive" } },
        { ipAddress: { contains: q } },
        { serialNumber: { contains: q, mode: "insensitive" } },
        { manufacturer: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { assetTag: { contains: q, mode: "insensitive" } },
        { bmcIpAddress: { contains: q } },
        { notes: { contains: q, mode: "insensitive" } },
        { cpus: { some: { model: { contains: q, mode: "insensitive" } } } },
        { memories: { some: { manufacturer: { contains: q, mode: "insensitive" } } } },
        { memories: { some: { partNumber: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  if (cpuModel) {
    andConditions.push({
      cpus: { some: { model: { contains: cpuModel, mode: "insensitive" } } },
    });
  }

  if (memoryType) {
    andConditions.push({
      memories: { some: { memoryType, populated: true } },
    });
  }

  if (memoryMfr) {
    andConditions.push({
      memories: { some: { manufacturer: { contains: memoryMfr, mode: "insensitive" }, populated: true } },
    });
  }

  if (manufacturer) {
    andConditions.push({
      manufacturer: { contains: manufacturer, mode: "insensitive" },
    });
  }

  if (model) {
    andConditions.push({
      model: { contains: model, mode: "insensitive" },
    });
  }

  if (biosVersion) {
    andConditions.push({
      biosVersion: { contains: biosVersion, mode: "insensitive" },
    });
  }

  if (status) {
    andConditions.push({ status });
  }

  if (minMemoryGb > 0) {
    andConditions.push({
      totalMemoryGB: { gte: minMemoryGb },
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const [items, total] = await Promise.all([
    prisma.equipment.findMany({
      where,
      include: {
        rack: { include: { room: true } },
        cpus: { orderBy: { socketIndex: "asc" }, take: 2 },
        memories: { where: { populated: true }, orderBy: { slotIndex: "asc" }, take: 2 },
        _count: { select: { memories: true, networkPorts: true } },
      },
      orderBy: { hostname: "asc" },
      take: limit,
    }),
    prisma.equipment.count({ where }),
  ]);

  const facets = await Promise.all([
    prisma.equipmentCpu.groupBy({
      by: ["model"],
      _count: true,
      where: { model: { not: null } },
      orderBy: { _count: { model: "desc" } },
      take: 20,
    }),
    prisma.equipmentMemory.groupBy({
      by: ["memoryType"],
      _count: true,
      where: { memoryType: { not: null }, populated: true },
      orderBy: { _count: { memoryType: "desc" } },
    }),
    prisma.equipmentMemory.groupBy({
      by: ["manufacturer"],
      _count: true,
      where: { manufacturer: { not: null }, populated: true },
      orderBy: { _count: { manufacturer: "desc" } },
      take: 20,
    }),
    prisma.equipment.groupBy({
      by: ["manufacturer"],
      _count: true,
      where: { manufacturer: { not: null } },
      orderBy: { _count: { manufacturer: "desc" } },
      take: 20,
    }),
    prisma.equipment.groupBy({
      by: ["biosVersion"],
      _count: true,
      where: { biosVersion: { not: null } },
      orderBy: { _count: { biosVersion: "desc" } },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    items,
    total,
    facets: {
      cpuModels: facets[0].map((f) => ({ value: f.model!, count: f._count })),
      memoryTypes: facets[1].map((f) => ({ value: f.memoryType!, count: f._count })),
      memoryManufacturers: facets[2].map((f) => ({ value: f.manufacturer!, count: f._count })),
      manufacturers: facets[3].map((f) => ({ value: f.manufacturer!, count: f._count })),
      biosVersions: facets[4].map((f) => ({ value: f.biosVersion!, count: f._count })),
    },
  });
}
