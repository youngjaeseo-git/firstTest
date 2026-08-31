import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format bytes to human-readable string (e.g., 1.5 GB) */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/** Format bytes/sec to human-readable throughput */
export function formatBandwidth(bytesPerSec: number): string {
  const bitsPerSec = bytesPerSec * 8;
  if (bitsPerSec === 0) return "0 bps";
  const k = 1000;
  const sizes = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];
  const i = Math.floor(Math.log(bitsPerSec) / Math.log(k));
  return `${parseFloat((bitsPerSec / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Format watts to human-readable power */
export function formatPower(watts: number): string {
  if (watts < 1000) return `${watts.toFixed(0)} W`;
  return `${(watts / 1000).toFixed(2)} kW`;
}

/** Format seconds to human-readable uptime */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Get severity color class */
export function getSeverityColor(severity: "critical" | "warning" | "info" | "ok"): string {
  const colors = {
    critical: "text-severity-critical bg-red-500/10",
    warning: "text-severity-warning bg-amber-500/10",
    info: "text-severity-info bg-blue-500/10",
    ok: "text-severity-ok bg-green-500/10",
  };
  return colors[severity];
}

/** Get temperature color based on value */
export function getTemperatureColor(temp: number): string {
  if (temp >= 85) return "text-red-500";
  if (temp >= 70) return "text-amber-500";
  if (temp >= 50) return "text-yellow-400";
  return "text-green-500";
}
