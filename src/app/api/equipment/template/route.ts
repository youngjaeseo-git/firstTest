import { NextRequest, NextResponse } from "next/server";

const CSV_HEADERS = [
  "hostname",
  "ipAddress",
  "bmcIpAddress",
  "type",
  "manufacturer",
  "model",
  "serialNumber",
  "assetTag",
  "rackName",
  "rackPosition",
  "rackHeight",
  "status",
  "osType",
  "osVersion",
  "biosVersion",
  "totalMemoryGB",
  "cpuManufacturer",
  "cpuModel",
  "cpuCores",
  "cpuThreads",
  "notes",
];

const EXAMPLE_ROWS = [
  [
    "gpu-node-001", "10.144.38.101", "10.144.100.101", "SERVER",
    "Dell", "PowerEdge R760", "SN-DELL-001", "ASSET-001",
    "Rack-A01", "1", "2", "ACTIVE",
    "Rocky Linux", "9.3", "2.20.1", "512",
    "Intel", "Xeon Gold 6448Y", "32", "64",
    "GPU 서버 1호기",
  ],
  [
    "gpu-node-002", "10.144.38.102", "10.144.100.102", "SERVER",
    "Dell", "PowerEdge R760", "SN-DELL-002", "ASSET-002",
    "Rack-A01", "3", "2", "ACTIVE",
    "Rocky Linux", "9.3", "2.20.1", "512",
    "Intel", "Xeon Gold 6448Y", "32", "64",
    "GPU 서버 2호기",
  ],
  [
    "storage-001", "10.144.38.201", "10.144.100.201", "STORAGE",
    "Supermicro", "SSG-6049P-E1CR36L", "SN-SM-001", "ASSET-003",
    "Rack-B01", "10", "4", "ACTIVE",
    "Ubuntu", "22.04 LTS", "1.4", "256",
    "AMD", "EPYC 7543", "32", "64",
    "스토리지 서버",
  ],
];

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") || "csv";

  if (format === "json") {
    const jsonTemplate = EXAMPLE_ROWS.map((row) => {
      const obj: Record<string, string> = {};
      CSV_HEADERS.forEach((h, i) => {
        obj[h] = row[i] || "";
      });
      return obj;
    });

    return NextResponse.json(jsonTemplate, {
      headers: {
        "Content-Disposition": 'attachment; filename="equipment-template.json"',
      },
    });
  }

  // CSV format
  const lines = [CSV_HEADERS.join(",")];
  for (const row of EXAMPLE_ROWS) {
    const escaped = row.map((val) =>
      val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val,
    );
    lines.push(escaped.join(","));
  }

  const csvContent = "\uFEFF" + lines.join("\n"); // BOM for Excel Korean support

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="equipment-template.csv"',
    },
  });
}
