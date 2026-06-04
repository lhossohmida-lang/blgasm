import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

/**
 * POST /api/admin/clean-sync-queue
 * Deletes syncQueue documents that are "synced" and older than 7 days.
 * Uses the standard Firebase client SDK — no Admin SDK or Blaze plan needed.
 * Called automatically once per day via useDailyCleanup hook.
 */
export async function POST(request: NextRequest) {
  // Simple shared-secret guard
  const token = request.headers.get("x-blgasm-token");
  if (token !== (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "blgasm")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffIso = cutoff.toISOString();

    // Get all stores
    const storesSnap = await getDocs(collection(db, "stores"));
    let totalDeleted = 0;

    for (const storeDoc of storesSnap.docs) {
      const oldOps = await getDocs(
        query(
          collection(db, "stores", storeDoc.id, "syncQueue"),
          where("status", "==", "synced"),
          where("syncedAt", "<", cutoffIso),
        ),
      );

      if (oldOps.empty) continue;

      // Firestore batch allows up to 500 ops
      const chunks = [];
      for (let i = 0; i < oldOps.docs.length; i += 490) {
        chunks.push(oldOps.docs.slice(i, i + 490));
      }
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      totalDeleted += oldOps.size;
    }

    return NextResponse.json({ deleted: totalDeleted, ok: true });
  } catch (err) {
    console.error("[clean-sync-queue]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
