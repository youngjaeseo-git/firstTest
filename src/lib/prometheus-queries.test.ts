import { describe, it, expect } from "vitest";
import { queries } from "./prometheus";

describe("prometheus query builders", () => {
  describe("instance matcher regex escaping", () => {
    it("escapes dots in IPv4 so 10.144.38.1 does not cross-match .10/.11", () => {
      const q = queries.nodeUp("10.144.38.1:9100");
      // PromQL string needs \\\\ to produce \\ which regex interprets as literal dot
      expect(q).toContain("10\\\\.144\\\\.38\\\\.1");
      // raw unescaped form must NOT appear
      expect(q).not.toMatch(/instance=~"10\.144\.38\.1\(/);
    });

    it("strips the port and matches optional port suffix", () => {
      const q = queries.nodeUp("10.144.38.1:9100");
      expect(q).toContain("(:.*)?");
    });

    it("escapes hostIp override in node-exporter matcher", () => {
      const q = queries.nodeExporterUp("somehost", "10.0.0.5");
      expect(q).toContain("10\\\\.0\\\\.0\\\\.5");
      expect(q).toContain('job="node-exporter"');
    });
  });

  describe("allNodesUp job exclusion", () => {
    it("excludes kubernetes-service-endpoints (no typo)", () => {
      const q = queries.allNodesUp();
      expect(q).toContain("kubernetes-service-endpoints");
      // the previous typo must not reappear
      expect(q).not.toContain("kubernetes-sevice-endpoints");
    });
  });
});
