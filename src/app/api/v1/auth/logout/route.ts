import { invalidateSession } from "@/lib/auth/session";
import { success, serverError } from "@/lib/api";

export async function POST() {
  try {
    await invalidateSession();

    return success({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    return serverError("Failed to log out");
  }
}
