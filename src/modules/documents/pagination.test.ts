import { expect, it } from "vitest";
import { paginateDocuments } from "./pagination";
it("keeps every document reachable exactly once across pages", () => {
  const files = Array.from({ length: 123 }, (_, id) => ({ id }));
  const pages = [1, 2, 3].map((page) => paginateDocuments(files, String(page)));
  expect(pages.flatMap((page) => page.items)).toEqual(files);
  expect(pages.map((page) => page.items.length)).toEqual([48, 48, 27]);
});
it("handles empty data, malformed parameters and deleted last-page files", () => {
  expect(paginateDocuments([], "999")).toMatchObject({
    page: 1,
    pages: 1,
    items: [],
  });
  const files = Array.from({ length: 50 }, (_, id) => id);
  for (const invalid of ["-1", "NaN", "1.5", "999999999999999", ["1", "2"]])
    expect(paginateDocuments(files, invalid).page).toBe(1);
  expect(paginateDocuments(files, "999").items).toEqual([48, 49]);
});
