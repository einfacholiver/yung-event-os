export function paginateDocuments<T>(
  items: T[],
  requestedPage?: string | string[],
) {
  const size = 48;
  const pages = Math.max(1, Math.ceil(items.length / size));
  const parsed =
    typeof requestedPage === "string" && /^\d{1,6}$/.test(requestedPage)
      ? Number(requestedPage)
      : 1;
  const page = Math.min(pages, Math.max(1, parsed));
  const offset = (page - 1) * size;
  return { page, pages, offset, items: items.slice(offset, offset + size) };
}
