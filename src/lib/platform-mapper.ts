const PLATFORM_RULES: Array<{ platform: string; patterns: string[] }> = [
  { platform: "Sapphire Rapids (SPR)", patterns: ["SYS-121H", "SPR"] },
  { platform: "Granite Rapids AP (GNR-AP)", patterns: ["GNR-AP", "SYS-222H"] },
  { platform: "Granite Rapids SP (GNR-SP)", patterns: ["GNR-SP"] },
  { platform: "Sierra Forest (SRF)", patterns: ["SRF"] },
];

export function getPlatform(model: string | null | undefined): string {
  if (!model) return "Unknown";
  const upper = model.toUpperCase().replace(/-/g, "");
  for (const rule of PLATFORM_RULES) {
    for (const pat of rule.patterns) {
      if (upper.includes(pat.toUpperCase().replace(/-/g, ""))) return rule.platform;
    }
  }
  return model;
}

export function getNormalizedModel(model: string | null | undefined): string {
  if (!model) return "Unknown";
  return model.replace(/-/g, "").toUpperCase();
}
