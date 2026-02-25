// tests/discovery/benchmark.ts
// Isolated benchmark: cold discovery vs cached discovery
import { rmSync } from "fs";
import { join } from "path";
import { discoverContext } from "../../src/discovery/discover";
import { readCache, writeCache } from "../../src/discovery/cache";

const projectRoot = process.argv[2] || process.cwd();
const cachePath = join(projectRoot, ".claude", ".cache", "discovery-cache.json");
const RUNS = 5;

// Estimate tokens (~4 chars per token, rough approximation)
function estimateTokens(json: string): number {
  return Math.ceil(json.length / 4);
}

async function benchCold(): Promise<{ ms: number; json: string }> {
  // Ensure no cache
  try { rmSync(cachePath); } catch {}

  const start = Bun.nanoseconds();
  const context = await discoverContext(projectRoot);
  const ms = (Bun.nanoseconds() - start) / 1e6;
  return { ms, json: JSON.stringify(context, null, 2) };
}

async function benchWarm(): Promise<{ ms: number; json: string; hit: boolean }> {
  const start = Bun.nanoseconds();
  const cached = await readCache(projectRoot);
  const ms = (Bun.nanoseconds() - start) / 1e6;
  if (cached) {
    return { ms, json: JSON.stringify(cached, null, 2), hit: true };
  }
  return { ms, json: "", hit: false };
}

console.log(`Benchmarking discovery: ${RUNS} runs each\n`);
console.log(`Project root: ${projectRoot}\n`);

// --- Cold runs (full discovery, no cache) ---
const coldTimes: number[] = [];
let coldJson = "";
for (let i = 0; i < RUNS; i++) {
  const { ms, json } = await benchCold();
  coldTimes.push(ms);
  coldJson = json;
}

// Write cache for warm runs
try { rmSync(cachePath); } catch {}
const ctx = await discoverContext(projectRoot);
await writeCache(projectRoot, ctx);

// --- Warm runs (cache hit) ---
const warmTimes: number[] = [];
let warmJson = "";
let allHits = true;
for (let i = 0; i < RUNS; i++) {
  const { ms, json, hit } = await benchWarm();
  warmTimes.push(ms);
  warmJson = json;
  if (!hit) allHits = false;
}

// --- Results ---
const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
const min = (arr: number[]) => Math.min(...arr);

const coldAvg = avg(coldTimes);
const warmAvg = avg(warmTimes);
const coldMin = min(coldTimes);
const warmMin = min(warmTimes);

const coldTokens = estimateTokens(coldJson);
const warmTokens = estimateTokens(warmJson);

// Count files scanned
const cacheFile = Bun.file(cachePath);
const cacheSize = (await cacheFile.stat()).size;

console.log("=== COLD (full discovery, no cache) ===");
console.log(`  Avg: ${coldAvg.toFixed(2)} ms`);
console.log(`  Min: ${coldMin.toFixed(2)} ms`);
console.log(`  Runs: [${coldTimes.map(t => t.toFixed(2) + "ms").join(", ")}]`);
console.log(`  Output: ${coldJson.length} chars (~${coldTokens} tokens)`);

console.log("");
console.log("=== WARM (cached, stat fingerprint check) ===");
console.log(`  Avg: ${warmAvg.toFixed(2)} ms`);
console.log(`  Min: ${warmMin.toFixed(2)} ms`);
console.log(`  Runs: [${warmTimes.map(t => t.toFixed(2) + "ms").join(", ")}]`);
console.log(`  Output: ${warmJson.length} chars (~${warmTokens} tokens)`);
console.log(`  All cache hits: ${allHits}`);
console.log(`  Cache file size: ${cacheSize} bytes`);

console.log("");
console.log("=== COMPARISON ===");
console.log(`  Speedup (avg): ${(coldAvg / warmAvg).toFixed(1)}x faster`);
console.log(`  Speedup (min): ${(coldMin / warmMin).toFixed(1)}x faster`);
console.log(`  Time saved (avg): ${(coldAvg - warmAvg).toFixed(2)} ms`);
console.log(`  Token cost: identical (${coldTokens} tokens both paths)`);
console.log(`  Output matches: ${coldJson === warmJson}`);

// Cleanup
try { rmSync(cachePath); } catch {}
