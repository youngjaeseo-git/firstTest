"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Upload } from "lucide-react";

interface ParsedRow {
  [key: string]: string;
}

interface RowError {
  row: number;
  field: string;
  message: string;
}

const REQUIRED_FIELDS = ["hostname", "ipAddress", "serialNumber"];
const ALL_FIELDS = [
  "hostname", "ipAddress", "bmcIpAddress", "type", "manufacturer", "model",
  "serialNumber", "assetTag", "rackName", "rackPosition", "rackHeight",
  "status", "osType", "osVersion", "biosVersion", "totalMemoryGB",
  "cpuManufacturer", "cpuModel", "cpuCores", "cpuThreads", "notes",
];

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

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 1) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^\uFEFF/, ""));
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: ParsedRow = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

export default function BulkImportPage() {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    created?: number;
    error?: string;
    errors?: RowError[];
    duplicates?: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);

      if (rows.length === 0) {
        setErrors([{ row: 0, field: "", message: "데이터가 비어있습니다" }]);
        return;
      }

      // Validate headers
      const unknownHeaders = headers.filter((h) => !ALL_FIELDS.includes(h));
      if (unknownHeaders.length > 0) {
        setErrors([
          {
            row: 0,
            field: "headers",
            message: `알 수 없는 컬럼: ${unknownHeaders.join(", ")}`,
          },
        ]);
      }

      // Check that at least one identifying field exists
      const hasIdentifier = headers.some((h) => REQUIRED_FIELDS.includes(h));
      if (!hasIdentifier) {
        setErrors([
          {
            row: 0,
            field: "headers",
            message:
              "hostname, ipAddress, serialNumber 중 하나 이상의 컬럼이 필요합니다",
          },
        ]);
        return;
      }

      // Client-side row validation
      const rowErrors: RowError[] = [];
      rows.forEach((row, i) => {
        const hasId =
          row.hostname?.trim() ||
          row.ipAddress?.trim() ||
          row.serialNumber?.trim();
        if (!hasId) {
          rowErrors.push({
            row: i + 1,
            field: "hostname/ipAddress/serialNumber",
            message: "식별자(hostname, ipAddress, serialNumber) 중 하나는 필수",
          });
        }
      });

      setParsedHeaders(headers);
      setParsedRows(rows);
      setErrors(rowErrors);
      setStep("preview");
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/equipment/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, created: data.created });
        setStep("result");
      } else {
        setResult({
          success: false,
          error: data.error,
          errors: data.errors,
          duplicates: data.duplicates,
        });
      }
    } catch {
      setResult({ success: false, error: "네트워크 오류가 발생했습니다" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setStep("upload");
    setParsedHeaders([]);
    setParsedRows([]);
    setErrors([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
        <Link href="/infrastructure" className="hover:text-gray-50">
          Infrastructure
        </Link>
        <span>/</span>
        <span>일괄 등록</span>
      </div>
      <PageHeader
        icon={Upload}
        title="장비 일괄 등록"
        subtitle="CSV 파일로 다수의 장비를 한 번에 등록합니다"
        accent="blue"
        right={
          <div className="flex gap-2">
            <a
              href="/api/equipment/template?format=csv"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV 템플릿 다운로드
            </a>
            <a
              href="/api/equipment/template?format=json"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              JSON 템플릿
            </a>
          </div>
        }
      />

      {/* Step indicator */}
      <div className="flex items-center gap-4 text-sm">
        <StepBadge num={1} label="파일 업로드" active={step === "upload"} done={step !== "upload"} />
        <div className="h-px w-8 bg-gray-700" />
        <StepBadge num={2} label="미리보기 & 검증" active={step === "preview"} done={step === "result"} />
        <div className="h-px w-8 bg-gray-700" />
        <StepBadge num={3} label="등록 완료" active={step === "result"} done={false} />
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card className="bg-gray-800/50 border-gray-700 p-8">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragActive
                ? "border-blue-400 bg-blue-500/10"
                : "border-gray-600 hover:border-gray-500"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-lg text-gray-300 mb-2">
              CSV 파일을 여기에 드래그하거나
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
            >
              파일 선택
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <p className="text-sm text-gray-500 mt-3">
              CSV 형식, 최대 500개 행 지원
            </p>
          </div>

          {/* Field reference */}
          <div className="mt-8">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              CSV 컬럼 안내
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
              {ALL_FIELDS.map((f) => (
                <div key={f} className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      REQUIRED_FIELDS.includes(f)
                        ? "bg-yellow-400"
                        : "bg-gray-600"
                    }`}
                  />
                  <code className="text-gray-400">{f}</code>
                  {REQUIRED_FIELDS.includes(f) && (
                    <span className="text-yellow-500">*</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * hostname, ipAddress, serialNumber 중 하나 이상 필수
            </p>
          </div>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center rounded-full border border-blue-400/30 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                {parsedRows.length}개 행
              </span>
              <span className="inline-flex items-center rounded-full border border-gray-600 px-2.5 py-0.5 text-xs font-medium text-gray-400">
                {parsedHeaders.length}개 컬럼
              </span>
              {errors.length > 0 && (
                <span className="inline-flex items-center rounded-full border border-red-400/30 px-2.5 py-0.5 text-xs font-medium text-red-400">
                  {errors.length}개 오류
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetAll}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                다시 선택
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || errors.length > 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    등록 중...
                  </>
                ) : (
                  `${parsedRows.length}개 장비 등록`
                )}
              </button>
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <Card className="bg-red-900/20 border-red-700/50 p-4">
              <h3 className="text-sm font-medium text-red-400 mb-2">
                유효성 검사 오류
              </h3>
              <ul className="space-y-1 text-sm text-red-300">
                {errors.slice(0, 10).map((err, i) => (
                  <li key={i}>
                    {err.row > 0 && (
                      <span className="text-red-400">행 {err.row}: </span>
                    )}
                    {err.message}
                  </li>
                ))}
                {errors.length > 10 && (
                  <li className="text-red-500">
                    ... 외 {errors.length - 10}개 오류
                  </li>
                )}
              </ul>
            </Card>
          )}

          {/* Server error result */}
          {result && !result.success && (
            <Card className="bg-red-900/20 border-red-700/50 p-4">
              <h3 className="text-sm font-medium text-red-400 mb-2">
                등록 실패
              </h3>
              <p className="text-sm text-red-300">{result.error}</p>
              {result.duplicates && (
                <p className="text-sm text-red-300 mt-1">
                  중복 항목: {result.duplicates.join(", ")}
                </p>
              )}
              {result.errors && (
                <ul className="mt-2 space-y-1 text-sm text-red-300">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>
                      행 {err.row}: [{err.field}] {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* Data table preview */}
          <Card className="bg-gray-800/50 border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800">
                    <th className="px-3 py-2 text-left text-xs text-gray-400 font-medium w-12">
                      #
                    </th>
                    {parsedHeaders.map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs text-gray-400 font-medium whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 50).map((row, i) => {
                    const rowHasError = errors.some((e) => e.row === i + 1);
                    return (
                      <tr
                        key={i}
                        className={`border-b border-gray-700/50 ${
                          rowHasError
                            ? "bg-red-900/10"
                            : i % 2 === 0
                              ? "bg-gray-800/30"
                              : ""
                        }`}
                      >
                        <td className="px-3 py-1.5 text-gray-500 text-xs">
                          {i + 1}
                        </td>
                        {parsedHeaders.map((h) => (
                          <td
                            key={h}
                            className="px-3 py-1.5 text-gray-300 whitespace-nowrap max-w-[200px] truncate"
                          >
                            {row[h] || (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {parsedRows.length > 50 && (
              <div className="px-4 py-2 text-sm text-gray-500 border-t border-gray-700">
                처음 50개 행만 표시됩니다 (전체 {parsedRows.length}개)
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Step 3: Result */}
      {step === "result" && result?.success && (
        <Card className="bg-gray-800/50 border-gray-700 p-8 text-center">
          <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-green-400 mb-2">등록 완료</h2>
          <p className="text-gray-400 mb-6">
            {result.created}개의 장비가 성공적으로 등록되었습니다
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/infrastructure"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              장비 목록 보기
            </Link>
            <button
              onClick={resetAll}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            >
              추가 등록
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function StepBadge({
  num,
  label,
  active,
  done,
}: {
  num: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          active
            ? "bg-blue-600 text-white"
            : done
              ? "bg-green-600 text-white"
              : "bg-gray-700 text-gray-400"
        }`}
      >
        {done ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          num
        )}
      </div>
      <span className={active ? "text-gray-50" : "text-gray-500"}>{label}</span>
    </div>
  );
}
