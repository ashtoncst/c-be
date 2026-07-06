import type { CsvItem } from "./catalog.util.js";

export type QueryBuilder = (item: CsvItem) => string;

export const solutionQueries: QueryBuilder[] = [
  (i) => `we need ${i.name.toLowerCase()}`,
  (i) => `${i.name} options?`,
  (i) => `help me choose ${i.name}`,
  (i) => `for a hotel, ${i.name}?`,
  (i) => `for 3 branches, ${i.name}`,
  (i) => `budget 15000 php for ${i.name}`,
  (i) => `urgent ${i.name} today`,
  (i) => `compare ${i.name} choices`,
  (i) => `which ${i.name} is best for a startup`,
  (i) => `enterprise ${i.name} recommendation`,
];

export const categoryQueries: QueryBuilder[] = [
  (i) => `we need ${i.name.toLowerCase()}`,
  (i) => `tell me about ${i.name}`,
  (i) => `what ${i.name} options do you have?`,
  (i) => `hotel use case: ${i.name}`,
  (i) => `multi-branch: ${i.name}`,
  (i) => `is ${i.name} right for SMEs?`,
  (i) => `compare tiers under ${i.name}`,
  (i) => `${i.name} for retail POS`,
  (i) => `pricing for ${i.name}`,
  (i) => `recommend ${i.name} for enterprise`,
];

export const productQueries: QueryBuilder[] = [
  (i) => `${i.name}`,
  (i) => `${i.name.toLowerCase()}`,
  (i) => `is ${i.name} available?`,
  (i) => `price of ${i.name}`,
  (i) => `need ${i.name} for our office`,
  (i) => `can you recommend ${i.name}?`,
  (i) => `compare ${i.name} with other options`,
  (i) => `does ${i.name} support hotels?`,
  (i) => `is ${i.name} good for startups?`,
  (i) => `tell me more about ${i.name}`,
];


