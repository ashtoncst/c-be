import { db } from "../../../src/db/index.js";
import { item } from "../../../src/models/schema.model.js";

export type CatalogItem = {
  id: number;
  name: string;
  itemType: "solution" | "category" | "product";
  parentItemId: number | null;
};

export async function loadCatalog(): Promise<CatalogItem[]> {
  const rows = await (db as unknown as {
    select: (s: unknown) => { from: (t: unknown) => Promise<Array<{ id: number; name: string; itemType: string; parentItemId: number | null }>> };
  }).select({ id: item.id, name: item.name, itemType: item.itemType, parentItemId: item.parentItemId }).from(item);
  return rows.map((r) => ({ id: r.id, name: r.name, itemType: r.itemType as CatalogItem["itemType"], parentItemId: r.parentItemId }));
}


