import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/rbac";
import type { EquipmentType, EquipmentStatus } from "@prisma/client";

const VALID_TYPES: EquipmentType[] = [
  "SERVER", "SWITCH", "ROUTER", "FIREWALL", "STORAGE",
  "PDU", "UPS", "PATCH_PANEL", "OTHER",
];
const VALID_STATUSES: EquipmentStatus[] = [
  "PLANNED", "RECEIVING", "INSTALLED", "ACTIVE", "MAINTENANCE",
  "REPAIR", "FAILED", "DECOMMISSIONED", "DISPOSED",
];

interface BulkRow {
  hostname?: string;
  ipAddress?: string;
  bmcIpAddress?: string;
  type?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  assetTag?: string;
  rackName?: string;
  rackId?: string;
  rackPosition?: number | string;
  rackHeight?: number | string;
  status?: string;
  osType?: string;
  osVersion?: string;
  biosVersion?: string;
  totalMemoryGB?: number | string;
  notes?: string;
  // CPU info (single socket shorthand)
  cpuManufacturer?: string;
  cpuModel?: string;
  cpuCores?: number | string;
  cpuThreads?: number | string;
}

interface RowError {
  row: number;
  field: string;
  message: string;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function validateRow(row: BulkRow, idx: number): RowError[] {
  const errors: RowError[] = [];
  const rowNum = idx + 1;

  if (!row.hostname && !row.ipAddress && !row.serialNumber) {
    errors.push({
      row: rowNum,
      field: "hostname/ipAddress/serialNumber",
      message: "hostname, ipAddress, serialNumber 중 하나는 필수입니다",
    });
  }

  const type = (row.type || "SERVER").toUpperCase();
  if (!VALID_TYPES.includes(type as EquipmentType)) {
    errors.push({
      row: rowNum,
      field: "type",
      message: `유효하지 않은 장비 유형: ${row.type}`,
    });
  }

  if (row.status) {
    const status = row.status.toUpperCase();
    if (!VALID_STATUSES.includes(status as EquipmentStatus)) {
      errors.push({
        row: rowNum,
        field: "status",
        message: `유효하지 않은 상태: ${row.status}`,
      });
    }
  }

  if (row.rackPosition) {
    const pos = parseInt(String(row.rackPosition));
    if (isNaN(pos) || pos < 1) {
      errors.push({
        row: rowNum,
        field: "rackPosition",
        message: "랙 위치는 1 이상의 정수여야 합니다",
      });
    }
  }

  return errors;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json(
      { error: "Forbidden — ADMIN 또는 OPERATOR 권한 필요" },
      { status: 403 },
    );
  }

  const contentType = req.headers.get("content-type") || "";
  let rows: BulkRow[];

  if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    const text = await req.text();
    rows = parseCSV(text) as unknown as BulkRow[];
  } else {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }
    const maybeRows = (body as { rows?: unknown })?.rows;
    if (Array.isArray(body)) {
      rows = body;
    } else if (Array.isArray(maybeRows)) {
      rows = maybeRows;
    } else {
      return NextResponse.json(
        { error: "JSON body는 배열이거나 { rows: [...] } 형태여야 합니다" },
        { status: 400 },
      );
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "데이터가 비어있습니다" }, { status: 400 });
  }

  if (rows.length > 500) {
    return NextResponse.json(
      { error: "한 번에 최대 500개까지 등록할 수 있습니다" },
      { status: 400 },
    );
  }

  // Validate all rows
  const allErrors: RowError[] = [];
  rows.forEach((row, i) => {
    allErrors.push(...validateRow(row, i));
  });

  if (allErrors.length > 0) {
    return NextResponse.json(
      { error: "유효성 검사 실패", errors: allErrors, total: rows.length },
      { status: 400 },
    );
  }

  // Resolve rack names to IDs
  const rackNameSet = new Set<string>();
  for (const row of rows) {
    if (row.rackName && !row.rackId) {
      rackNameSet.add(row.rackName);
    }
  }

  const rackMap = new Map<string, string>();
  if (rackNameSet.size > 0) {
    const racks = await prisma.rack.findMany({
      where: { name: { in: Array.from(rackNameSet) } },
      select: { id: true, name: true },
    });
    for (const rack of racks) {
      rackMap.set(rack.name, rack.id);
    }

    // Check for unresolved rack names
    Array.from(rackNameSet).forEach((name) => {
      if (!rackMap.has(name)) {
        allErrors.push({
          row: 0,
          field: "rackName",
          message: `존재하지 않는 랙 이름: ${name}`,
        });
      }
    });
    if (allErrors.length > 0) {
      return NextResponse.json(
        { error: "존재하지 않는 랙 이름이 있습니다", errors: allErrors },
        { status: 400 },
      );
    }
  }

  // Check for duplicate serial numbers within the batch
  const serials = rows.map((r) => r.serialNumber).filter(Boolean) as string[];
  const uniqueSerials = new Set(serials);
  if (serials.length !== uniqueSerials.size) {
    return NextResponse.json(
      { error: "CSV 내에 중복된 시리얼 번호가 있습니다" },
      { status: 400 },
    );
  }

  // Check for existing serial numbers in DB
  if (serials.length > 0) {
    const existing = await prisma.equipment.findMany({
      where: { serialNumber: { in: serials } },
      select: { serialNumber: true },
    });
    if (existing.length > 0) {
      return NextResponse.json(
        {
          error: "이미 등록된 시리얼 번호가 있습니다",
          duplicates: existing.map((e) => e.serialNumber),
        },
        { status: 409 },
      );
    }
  }

  // Check for duplicate asset tags
  const assetTags = rows.map((r) => r.assetTag).filter(Boolean) as string[];
  if (assetTags.length > 0) {
    const uniqueTags = new Set(assetTags);
    if (assetTags.length !== uniqueTags.size) {
      return NextResponse.json(
        { error: "CSV 내에 중복된 자산 태그가 있습니다" },
        { status: 400 },
      );
    }
    const existingTags = await prisma.equipment.findMany({
      where: { assetTag: { in: assetTags } },
      select: { assetTag: true },
    });
    if (existingTags.length > 0) {
      return NextResponse.json(
        {
          error: "이미 등록된 자산 태그가 있습니다",
          duplicates: existingTags.map((e) => e.assetTag),
        },
        { status: 409 },
      );
    }
  }

  // Auto-assign organization for non-ADMIN users
  const autoOrgId = user.role !== "ADMIN" && user.orgIds.length > 0
    ? user.orgIds[0]
    : null;

  // Bulk create in transaction
  const created = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const row of rows) {
      const resolvedRackId = row.rackId || (row.rackName ? rackMap.get(row.rackName) : undefined);

      const cpuData =
        row.cpuManufacturer || row.cpuModel
          ? {
              create: [
                {
                  socketIndex: 0,
                  manufacturer: row.cpuManufacturer || null,
                  model: row.cpuModel || null,
                  cores: row.cpuCores ? parseInt(String(row.cpuCores)) : null,
                  threads: row.cpuThreads ? parseInt(String(row.cpuThreads)) : null,
                },
              ],
            }
          : undefined;

      const eq = await tx.equipment.create({
        data: {
          hostname: row.hostname || null,
          ipAddress: row.ipAddress || null,
          bmcIpAddress: row.bmcIpAddress || null,
          type: ((row.type || "SERVER").toUpperCase() as EquipmentType),
          manufacturer: row.manufacturer || null,
          model: row.model || null,
          serialNumber: row.serialNumber || null,
          assetTag: row.assetTag || null,
          rackId: resolvedRackId || null,
          rackPosition: row.rackPosition ? parseInt(String(row.rackPosition)) : null,
          rackHeight: row.rackHeight ? parseInt(String(row.rackHeight)) : 1,
          status: ((row.status || "ACTIVE").toUpperCase() as EquipmentStatus),
          osType: row.osType || null,
          osVersion: row.osVersion || null,
          biosVersion: row.biosVersion || null,
          totalMemoryGB: row.totalMemoryGB ? parseInt(String(row.totalMemoryGB)) : null,
          notes: row.notes || null,
          cpus: cpuData,
          ...(autoOrgId ? { organizationId: autoOrgId } : {}),
        },
      });
      results.push(eq);
    }
    return results;
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "BULK_CREATE",
      entityType: "Equipment",
      entityId: "bulk",
      changes: {
        count: created.length,
        ids: created.map((e) => e.id),
      },
    },
  });

  return NextResponse.json(
    { success: true, created: created.length, items: created },
    { status: 201 },
  );
}
