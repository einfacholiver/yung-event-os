import { expect, it } from "vitest";
import { eventSlug, newEventSchema } from "./create-schema";
it("normalizes the YUNG prefix and rejects paths and control characters", () => {
  expect(newEventSchema.parse({ name: " Chapter Five " }).name).toBe(
    "YUNG Chapter Five",
  );
  expect(newEventSchema.parse({ name: "YUNG Chapter Five" }).name).toBe(
    "YUNG Chapter Five",
  );
  expect(eventSlug("YUNG Frühlings-Event")).toBe("yung-fruhlings-event");
  for (const name of ["../Chapter", "Chapter/Five", "Chapter\nFive"])
    expect(newEventSchema.safeParse({ name }).success).toBe(false);
});
