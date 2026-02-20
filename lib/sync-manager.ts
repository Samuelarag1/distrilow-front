import { db, PendingAction, Sale } from "@/lib/db";

// Process pending actions when back online
export async function syncPendingActions() {
  const pending = await db.pendingActions.where("synced").equals(0).toArray();

  if (pending.length === 0) return;

  console.log(`Attempting to sync ${pending.length} actions...`);

  for (const action of pending) {
    try {
      // Mock processing sync - in real app would call API
      console.log(`Syncing action: ${action.type}`, action.payload);

      // Simulate API call based on action type
      let success = false;

      switch (action.type) {
        case "CREATE_SALE":
          success = await mockApiSync("/api/sales", "POST", action.payload);
          break;
        case "CREATE_CLIENT":
          success = await mockApiSync("/api/clients", "POST", action.payload);
          break;
        // Add other cases
        default:
          success = true;
      }

      if (success) {
        // If synced, remove from queue or mark as synced
        await db.pendingActions.delete(action.id);

        // If sale, update status from PENDING to COMPLETED locally
        if (action.type === "CREATE_SALE" && action.payload.tempId) {
          await db.sales.update(action.payload.tempId, { status: "COMPLETED" });
        }
      } else {
        await db.pendingActions.update(action.id, {
          failedCount: (action.failedCount || 0) + 1,
        });
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

async function mockApiSync(url: string, method: string, body: any) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log(`[Mock Sync] Processed ${method} to ${url}`, body);
  return true;
}
