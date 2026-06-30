import { describe, it, expect } from "vitest";
import {
  cn,
  formatBytes,
  formatBandwidth,
  formatPower,
  formatUptime,
  getSeverityColor,
  getTemperatureColor,
} from "./utils";

describe("cn (className merger)", () => {
  it("merges multiple class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("deduplicates conflicting Tailwind classes, keeping the latter", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("ignores falsy values", () => {
    expect(cn("px-2", false, null, undefined, "py-1")).toBe("px-2 py-1");
  });
});

describe("formatBytes", () => {
  it("returns '0 B' for zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes under 1KB without unit change", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
  });

  it("formats GB", () => {
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe("2.5 GB");
  });

  it("respects the decimals argument", () => {
    expect(formatBytes(1536, 0)).toBe("2 KB");
    expect(formatBytes(1536, 3)).toBe("1.5 KB");
  });
});

describe("formatBandwidth", () => {
  it("returns '0 bps' for zero", () => {
    expect(formatBandwidth(0)).toBe("0 bps");
  });

  it("converts bytes/sec to bits/sec and formats as Kbps", () => {
    // 1000 bytes/sec * 8 = 8000 bps = 8 Kbps
    expect(formatBandwidth(1000)).toBe("8 Kbps");
  });

  it("formats Mbps", () => {
    // 125_000 bytes/sec * 8 = 1_000_000 bps = 1 Mbps
    expect(formatBandwidth(125_000)).toBe("1 Mbps");
  });
});

describe("formatPower", () => {
  it("returns watts when under 1000", () => {
    expect(formatPower(500)).toBe("500 W");
    expect(formatPower(999)).toBe("999 W");
  });

  it("returns kilowatts when 1000 or above", () => {
    expect(formatPower(1500)).toBe("1.50 kW");
    expect(formatPower(2750)).toBe("2.75 kW");
  });
});

describe("formatUptime", () => {
  it("formats minutes only", () => {
    expect(formatUptime(120)).toBe("2m");
  });

  it("formats hours and minutes", () => {
    expect(formatUptime(3700)).toBe("1h 1m");
  });

  it("formats days, hours, and minutes", () => {
    expect(formatUptime(90061)).toBe("1d 1h 1m");
  });
});

describe("getSeverityColor", () => {
  it("returns critical color for critical severity", () => {
    expect(getSeverityColor("critical")).toContain("red");
  });

  it("returns warning color for warning severity", () => {
    expect(getSeverityColor("warning")).toContain("amber");
  });

  it("returns info color for info severity", () => {
    expect(getSeverityColor("info")).toContain("blue");
  });

  it("returns ok color for ok severity", () => {
    expect(getSeverityColor("ok")).toContain("green");
  });
});

describe("getTemperatureColor", () => {
  it("returns red for >=85°C", () => {
    expect(getTemperatureColor(85)).toBe("text-red-500");
    expect(getTemperatureColor(100)).toBe("text-red-500");
  });

  it("returns amber for 70-84°C", () => {
    expect(getTemperatureColor(75)).toBe("text-amber-500");
  });

  it("returns yellow for 50-69°C", () => {
    expect(getTemperatureColor(60)).toBe("text-yellow-400");
  });

  it("returns green for <50°C", () => {
    expect(getTemperatureColor(30)).toBe("text-green-500");
  });
});
