#!/usr/bin/env node
// tools/generate_chatbot_queries.mjs
// Generates test data JSON with 3-5 potential queries per catalog row.

import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, "..");
// eslint-disable-next-line no-undef
const CSV_PATH = (globalThis.process?.argv?.[2]) || path.join(ROOT, "Products - item.csv");
// eslint-disable-next-line no-undef
const OUT_PATH = (globalThis.process?.argv?.[3]) || path.join(ROOT, "test/data/chatbot_queries.json");

function readCsv(p) {
  const raw = fs.readFileSync(p, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  // Skip header junk lines; find header row
  const headerIdx = lines.findIndex((l) => /\bid\b,\s*name/i.test(l));
  const data = lines.slice(headerIdx + 1);
  const rows = [];
  for (const line of data) {
    // Basic CSV parsing (no quotes in our file contents)
    const parts = line.split(",").map((s) => s.trim());
    if (parts.length < 6) continue;
    const id = Number(parts[1]);
    const name = parts[2];
    const description = parts[3];
    const item_type = parts[4];
    const parent_item_id = parts[5] ? Number(parts[5]) : null;
    const is_active = /true/i.test(parts[9] || "true");
    if (!id || !name) continue;
    rows.push({ id, name, description, item_type, parent_item_id, is_active });
  }
  return rows;
}

function buildIndex(rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const categoriesBySolution = new Map();
  const productsByCategory = new Map();
  const productsBySolution = new Map();

  for (const r of rows) {
    if (r.item_type === "category" && r.parent_item_id) {
      if (!categoriesBySolution.has(r.parent_item_id)) categoriesBySolution.set(r.parent_item_id, []);
      categoriesBySolution.get(r.parent_item_id).push(r);
    }
    if (r.item_type === "product" && r.parent_item_id) {
      const parent = byId.get(r.parent_item_id);
      if (parent && parent.item_type === "category") {
        if (!productsByCategory.has(r.parent_item_id)) productsByCategory.set(r.parent_item_id, []);
        productsByCategory.get(r.parent_item_id).push(r);
      } else if (parent && parent.item_type === "solution") {
        if (!productsBySolution.has(r.parent_item_id)) productsBySolution.set(r.parent_item_id, []);
        productsBySolution.get(r.parent_item_id).push(r);
      }
    }
  }
  return { byId, categoriesBySolution, productsByCategory, productsBySolution };
}

function mkQueriesForSolution(sol) {
  const base = sol.name;
  const queries = [
    `tell me about ${base.toLowerCase()}`,
    `what services do you have for ${base.toLowerCase()}`,
    `${base} options`,
  ];
  if (/satellite|starlink/i.test(base)) queries.push("satellite for remote areas");
  if (/content/i.test(base)) queries.push("we need live tv for guests");
  return queries;
}

function mkQueriesForCategory(cat) {
  const base = cat.name;
  return [
    `what products do you have for ${base.toLowerCase()}`,
    `tell me about ${base.toLowerCase()} offerings`,
    `i need ${base.toLowerCase()}`,
  ];
}

function mkQueriesForProduct(prod) {
  const base = prod.name;
  return [
    `do you offer ${base.toLowerCase()}?`,
    `${base.toLowerCase()} details`,
    `price for ${base.toLowerCase()}`,
  ];
}

function expectationsForSolution(sol, index) {
  const { categoriesBySolution, productsBySolution } = index;
  const cats = categoriesBySolution.get(sol.id) || [];
  const prods = productsBySolution.get(sol.id) || [];
  // Prefer categories when present; solution-level products are likely catalog anomalies
  if (cats.length > 0) {
    return { expect_categories: cats.slice(0, 3).map((c) => c.name) };
  }
  if (prods.length > 0) {
    return { expect_products: prods.slice(0, 3).map((p) => p.name) };
  }
  return { expect_in_reply: [sol.name] };
}

function expectationsForCategory(cat, index) {
  const { productsByCategory } = index;
  const prods = productsByCategory.get(cat.id) || [];
  if (prods.length > 0) return { expect_products: prods.slice(0, 3).map((p) => p.name) };
  return { expect_in_reply: [cat.name] };
}

function expectationsForProduct(prod) {
  return { expect_products: [prod.name] };
}

function assemble(rows, index) {
  const items = [];
  for (const r of rows) {
    const entry = { id: r.id, name: r.name, item_type: r.item_type, parent_item_id: r.parent_item_id, queries: [] };
    if (r.item_type === "solution") {
      const qs = mkQueriesForSolution(r, index);
      const expect = expectationsForSolution(r, index);
      for (const q of qs) entry.queries.push({ q, expect: { solution: r.name, ...expect } });
    } else if (r.item_type === "category") {
      const qs = mkQueriesForCategory(r);
      const expect = expectationsForCategory(r, index);
      for (const q of qs) entry.queries.push({ q, expect: { category: r.name, ...expect } });
    } else if (r.item_type === "product") {
      const qs = mkQueriesForProduct(r);
      const expect = expectationsForProduct(r);
      for (const q of qs) entry.queries.push({ q, expect });
    }
    items.push(entry);
  }
  return { generated_at: new Date().toISOString(), source: path.relative(ROOT, CSV_PATH), items };
}

function main() {
  const rows = readCsv(CSV_PATH);
  const index = buildIndex(rows);
  const data = assemble(rows, index);
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(data, null, 2));
  console.log(`Wrote ${OUT_PATH} with ${data.items.length} items.`);
}

main();


