import { describe, expect, it } from "vitest";
import {
  DRIVE_ACCOUNT_EMAIL,
  DRIVE_METADATA_SCOPE,
  hasDriveScope,
  isAllowedGoogleIdentity,
} from "./config";

describe("Google identity policy", () => {
  it("requires the exact account, a verified email and a subject", () => {
    expect(
      isAllowedGoogleIdentity({
        email: DRIVE_ACCOUNT_EMAIL,
        email_verified: true,
        sub: "google-sub",
      }),
    ).toBe(true);
    for (const profile of [
      null,
      {},
      { email: "other@gmail.com", email_verified: true, sub: "s" },
      { email: DRIVE_ACCOUNT_EMAIL, sub: "s" },
      { email: DRIVE_ACCOUNT_EMAIL, email_verified: "true", sub: "s" },
      { email: DRIVE_ACCOUNT_EMAIL, email_verified: true },
    ])
      expect(isAllowedGoogleIdentity(profile)).toBe(false);
  });
  it("checks the actual granted scope", () => {
    expect(hasDriveScope(`openid email ${DRIVE_METADATA_SCOPE}`)).toBe(true);
    expect(hasDriveScope("openid email profile")).toBe(false);
    expect(hasDriveScope(`${DRIVE_METADATA_SCOPE}.fake`)).toBe(false);
  });
});
