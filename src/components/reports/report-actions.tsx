"use client";

import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

export function ReportActions() {
  function handlePrint() {
    window.print();
  }

  function handleExportJson() {
    const content = document.getElementById("report-content");
    if (!content) return;
    // Grab visible text blocks for a simple text export
    const text = content.innerText;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dcim-report-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={handleExportJson}>
        <Download className="mr-1 h-4 w-4" /> Export
      </Button>
      <Button variant="ghost" size="sm" onClick={handlePrint}>
        <Printer className="mr-1 h-4 w-4" /> Print / PDF
      </Button>
    </div>
  );
}
