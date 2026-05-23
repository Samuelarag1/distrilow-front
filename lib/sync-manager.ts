import { db } from "@/lib/db";
import { apiClientFetch } from "./api-client";

// Process pending actions when back online
export async function syncPendingActions() {
  const pending = await db.pendingActions.where("synced").equals(0).toArray();

  if (pending.length === 0) return;

  console.log(`Attempting to sync ${pending.length} actions...`);

  for (const action of pending) {
    try {
      let result = null;

      switch (action.type) {
        case "CREATE_SALE":
          result = await apiClientFetch.post("/sales", action.payload);
          break;
        case "CREATE_EXPENSE":
          result = await apiClientFetch.post("/expenses", action.payload);
          break;
        default:
          console.warn(`Sync not implemented for action type: ${action.type}`);
          result = true; // Mark as done to avoid stuck queue if not implemented
      }

      if (result) {
        // If synced successfully
        await db.pendingActions.delete(action.id);

        // If sale, update status from PENDING to COMPLETED locally
        if (action.type === "CREATE_SALE" && action.payload.tempId) {
          await db.sales.update(action.payload.tempId, { status: "COMPLETED" });
        }
      }
    } catch (error: any) {
      console.error(`Failed to sync action ${action.id}:`, error);
      await db.pendingActions.update(action.id, {
        failedCount: (action.failedCount || 0) + 1,
        error: error.message,
      });
    }
  }
}
