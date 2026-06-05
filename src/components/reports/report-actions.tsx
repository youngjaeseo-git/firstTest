"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, FileSpreadsheet, Download, Loader2 } from "lucide-react";
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

export function ReportActions({
  equipmentData,
  reportDate,
  periodStart,
  periodEnd,
}: ReportActionsProps) {
  const t = useT();
  const [pdfLoading, setPdfLoading] = useState(false);

  function handlePrint() {
    window.print();
  }

  // Native one-click PDF: rasterize the rendered report DOM (so Korean text
  // renders via browser fonts — no CJK font embedding needed) and paginate it
  // into A4 pages. jspdf/html2canvas are dynamically imported so they only load
  // when the user actually exports.
  async function handleDownloadPdf() {
    const target = document.getElementById("report-content");
    if (!target) return;
    setPdfLoading(true);
    try {
      const [{ jsPDF }, html2canvasModule] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const html2canvas = html2canvasModule.default;

      const bg =
        getComputedStyle(document.body).backgroundColor || "#030712";

      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: bg,
        useCORS: true,
        logging: false,
        windowWidth: target.scrollWidth,
        onclone: (doc) => {
          // The report's title block is hidden on screen (print-only). Reveal it
          // for the capture and force a light text color so it reads on the dark
          // background of the exported page.
          const header = doc.querySelector<HTMLElement>(".print-report-header");
          if (header) {
            header.classList.remove("hidden");
            header.style.display = "block";
            header.style.color = "#e5e7eb";
            header
              .querySelectorAll<HTMLElement>("*")
              .forEach((el) => (el.style.color = "#e5e7eb"));
          }
        },
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`dcim-report-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("[reports] PDF export failed", err);
      alert(t("reports.pdfError"));
    } finally {
      setPdfLoading(false);
    }
  }

  function handleExportCsv() {
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

    // Add summary rows
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
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownloadPdf}
        disabled={pdfLoading}
      >
        {pdfLoading ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-1 h-4 w-4" />
        )}{" "}
        {t("reports.downloadPdf")}
      </Button>
      <Button variant="ghost" size="sm" onClick={handlePrint}>
        <Printer className="mr-1 h-4 w-4" /> {t("reports.printPdf")}
      </Button>
    </div>
  );
}

/** Escape a value for CSV (wrap in quotes if it contains comma, quote, or newline) */
function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
