"use server";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/server/auth";

export async function loginAdmin() {
  try {
    await signIn(
      "google",
      { redirectTo: "/events" },
      {
        scope: "openid email profile",
        prompt: "select_account",
        include_granted_scopes: "true",
      },
    );
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=Authentication");
    throw error;
  }
}

export async function logoutAdmin() {
  await signOut({ redirectTo: "/login" });
}
