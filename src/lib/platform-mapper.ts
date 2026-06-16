const PLATFORM_RULES: Array<{ platform: string; patterns: string[] }> = [
  { platform: "Sapphire Rapids (SPR)", patterns: ["SYS-121H", "SPR"] },
  { platform: "Granite Rapids (GNR)", patterns: ["GNR-AP", "GNR-SP", "GNR"] },
  { platform: "Sierra Forest (SRF)", patterns: ["SRF"] },
  { platform: "Twin 2U (222H)", patterns: ["SYS-222H"] },
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
