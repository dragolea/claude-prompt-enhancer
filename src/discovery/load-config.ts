import type { EnhancerConfig } from "./types";

export function parseEnhancerConfig(raw: Record<string, any>): EnhancerConfig {
  return {
    aliases: raw.aliases ?? {},
    defaultGuards: raw.defaultGuards ?? [],
    conventions: raw.conventions ?? [],
    excludeAgents: raw.excludeAgents ?? [],
  };
}
