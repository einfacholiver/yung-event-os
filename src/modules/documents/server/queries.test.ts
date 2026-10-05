// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ files: vi.fn(), events: vi.fn() }));
vi.mock("@/server/db/client", () => ({
  getDb: () => ({
    event: { findMany: mocks.events },
    driveItem: { findMany: mocks.files },
  }),
}));
vi.mock("@/modules/drive/server/context", () => ({
  getDriveConnection: async () => ({
    organizationId: "org",
    connection: {
      id: "drive",
      rootFolderId: "root",
      rootFolderName: "Veranstaltungen",
    },
  }),
}));
import { getDocuments } from "./queries";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.events.mockResolvedValue([
    { id: "one", name: "Chapter One" },
    { id: "four", name: "Chapter Four" },
  ]);
});
it("uses the nearest saved mapping and retains the complete nested path", async () => {
  mocks.files
    .mockResolvedValueOnce([
      {
        id: "file",
        externalId: "file",
        parentExternalId: "nested",
        name: "Rechnung.pdf",
      },
    ])
    .mockResolvedValueOnce([
      {
        externalId: "chapter",
        parentExternalId: "root",
        name: "YUNG Chapter four 19.09.2026",
        folderMappings: [],
      },
      {
        externalId: "expenses",
        parentExternalId: "chapter",
        name: "Ausgaben",
        folderMappings: [{ eventId: "four", purpose: "EXPENSES" }],
      },
      {
        externalId: "nested",
        parentExternalId: "expenses",
        name: "Security",
        folderMappings: [],
      },
    ]);
  const { documents } = await getDocuments("four");
  expect(documents[0]).toMatchObject({
    event: { id: "four" },
    category: "EXPENSES",
    path: "Veranstaltungen / YUNG Chapter four 19.09.2026 / Ausgaben / Security / Rechnung.pdf",
  });
  expect(mocks.files.mock.calls[0][0].where).toMatchObject({
    organizationId: "org",
    connectionId: "drive",
    trashed: false,
  });
});
it("does not assign a folder mapped to conflicting events", async () => {
  mocks.files
    .mockResolvedValueOnce([
      {
        id: "file",
        externalId: "file",
        parentExternalId: "folder",
        name: "Rechnung.pdf",
      },
    ])
    .mockResolvedValueOnce([
      {
        externalId: "folder",
        parentExternalId: "root",
        name: "Ausgaben",
        folderMappings: [
          { eventId: "one", purpose: "EXPENSES" },
          { eventId: "four", purpose: "EXPENSES" },
        ],
      },
    ]);
  expect((await getDocuments("four")).documents).toEqual([]);
});
