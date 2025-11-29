import { invalidateSession } from "@/lib/auth/session";
import { success, serverError, logError, logInfo } from "@/lib/api";

const REQUEST_ID_PREFIX = "logout";

export async function POST() {
  const requestId = `${REQUEST_ID_PREFIX}_${Date.now().toString(36)}`;

  try {
    await invalidateSession();
    logInfo(requestId, "logout_success");
    return success({ message: "Logged out successfully" });
  } catch (err) {
    logError(requestId, "logout_error", err);
    return serverError("Failed to log out");
  }
}
