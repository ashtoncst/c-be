import fs from "node:fs";
import path from "node:path";

export type CsvItem = {
  id: number;
  name: string;
  itemType: "solution" | "category" | "product";
  parentItemId: number | null;
};

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function loadCatalogFromCsv(maxItemsPerType?: number): CsvItem[] {
  const csvPath = path.resolve(process.cwd(), "Products - item.csv");
  const buf = fs.readFileSync(csvPath, "utf8");
  const lines = buf.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const items: CsvItem[] = [];

  // Header expected around second line; skip the first line if it's a phantom
  for (let idx = 2; idx < lines.length; idx++) {
    const row = splitCsvLine(lines[idx]);
    // Row shape: [, id, name, description, item_type, parent_item_id, ...]
    if (row.length < 6) continue;
    const idStr = row[1]?.trim();
    const name = (row[2] || "").trim();
    const itemTypeRaw = (row[4] || "").trim();
    const parentStr = (row[5] || "").trim();
    const id = Number(idStr);
    const parentId = parentStr ? Number(parentStr) : null;
    if (!id || !name || !itemTypeRaw) continue;
    if (!isItemType(itemTypeRaw)) continue;
    items.push({ id, name, itemType: itemTypeRaw, parentItemId: parentId });
  }

  if (!maxItemsPerType) return items;
  const byType: Record<CsvItem["itemType"], CsvItem[]> = {
    solution: [],
    category: [],
    product: [],
  };
  for (const it of items) byType[it.itemType].push(it);
  return [
    ...byType.solution.slice(0, maxItemsPerType),
    ...byType.category.slice(0, maxItemsPerType),
    ...byType.product.slice(0, maxItemsPerType),
  ];
}

function isItemType(s: string): s is CsvItem["itemType"] {
  return s === "solution" || s === "category" || s === "product";
}


