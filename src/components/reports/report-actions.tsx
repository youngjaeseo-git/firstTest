"use client";

import { Button } from "@/components/ui/button";
import { Printer, FileSpreadsheet } from "lucide-react";
import { useT } from "@/lib/i18n/i18n-context";

export interface EquipmentRow {
  status: string;
  type: string;
  manufacturer: string | null;
  totalMemoryGB: number | null;
  rackHeight: number;
}

interface ReportActionsProps {
  equipmentData: EquipmentRow[];
  reportDate: string;
  periodStart: string;
  periodEnd: string;
}

/** Fire-and-forget audit log for report exports. */
function logReportExport(format: "CSV" | "PDF") {
  fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "EXPORT",
      entityType: "Report",
      entityId: "equipment-report",
      changes: { format, exportedAt: new Date().toISOString() },
    }),
  }).catch(() => {
    // Audit failures should never block the export action
  });
}

export function ReportActions({
  equipmentData,
  reportDate,
  periodStart,
  periodEnd,
}: ReportActionsProps) {
  const t = useT();

  function handlePrint() {
    logReportExport("PDF");
    window.print();
  }

  function handleExportCsv() {
    logReportExport("CSV");
    const headers = [
      "Status",
      "Type",
      "Manufacturer",
      "Total Memory (GB)",
      "Rack Height (U)",
    ];

    const csvRows = [headers.join(",")];

    for (const eq of equipmentData) {
      const row = [
        escapeCsv(eq.status),
        escapeCsv(eq.type),
        escapeCsv(eq.manufacturer || ""),
        eq.totalMemoryGB != null ? String(eq.totalMemoryGB) : "",
        String(eq.rackHeight),
      ];
      csvRows.push(row.join(","));
    }

    csvRows.push("");
    csvRows.push(`Report Generated,${escapeCsv(reportDate)}`);
    csvRows.push(`Data Period,${escapeCsv(periodStart)} - ${escapeCsv(periodEnd)}`);
    csvRows.push(`Total Equipment,${equipmentData.length}`);

    const csvContent = csvRows.join("\n");
    const blob = new Blob(["﻿" + csvContent], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dcim-equipment-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="ghost" size="sm" onClick={handleExportCsv}>
        <FileSpreadsheet className="mr-1 h-4 w-4" /> {t("reports.exportCsv")}
      </Button>
      <Button variant="ghost" size="sm" onClick={handlePrint}>
        <Printer className="mr-1 h-4 w-4" /> {t("reports.printPdf")}
      </Button>
    </div>
  );
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
