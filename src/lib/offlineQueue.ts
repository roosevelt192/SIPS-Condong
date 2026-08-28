import { supabase } from "@/lib/supabase";

export interface QueuedGateScan {
  id: string;
  permit_id: string;
  student_nis: string;
  student_name: string;
  action_type: "out" | "in";
  scan_time: string;
  is_late: boolean;
  synced: boolean;
}

const DB_NAME = "sips_offline_db";
const DB_VERSION = 1;
const STORE_NAME = "gate_scans_queue";

// Inisialisasi IndexedDB Browser
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB tidak didukung oleh browser ini."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Simpan Scan ke Antrean Lokal Offline
export async function saveOfflineScan(scan: Omit<QueuedGateScan, "synced">): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ ...scan, synced: false });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Ambil Antrean Offline yang Belum Tersinkron
export async function getUnsyncedScans(): Promise<QueuedGateScan[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const allScans: QueuedGateScan[] = request.result || [];
      resolve(allScans.filter((s) => !s.synced));
    };
    request.onerror = () => reject(request.error);
  });
}

// Hapus Scan Tertentu Setelah Sukses Sync
export async function removeSyncedScan(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Sinkronisasi Antrean Offline ke Supabase
export async function syncOfflineQueueToSupabase(): Promise<{
  syncedCount: number;
  failedCount: number;
}> {
  const pendingScans = await getUnsyncedScans();
  if (pendingScans.length === 0) return { syncedCount: 0, failedCount: 0 };

  let syncedCount = 0;
  let failedCount = 0;

  for (const scan of pendingScans) {
    try {
      const updatePayload =
        scan.action_type === "out"
          ? { status: "out_pondok", actual_out_at: scan.scan_time }
          : { status: "back_pondok", actual_in_at: scan.scan_time };

      const { error: permError } = await supabase
        .from("permissions")
        .update(updatePayload)
        .eq("id", scan.permit_id);

      if (permError) throw permError;

      // Catat log sinkronisasi
      await supabase.from("audit_logs").insert({
        action: scan.action_type === "out" ? "GATE_SCAN_OUT_OFFLINE" : "GATE_SCAN_IN_OFFLINE",
        target_type: "permissions",
        target_id: scan.permit_id,
        details: {
          santri_name: scan.student_name,
          santri_nis: scan.student_nis,
          status_izin: scan.action_type === "out" ? "out_pondok" : "back_pondok",
          waktu_aktual: scan.scan_time,
          terlambat: scan.is_late,
          sync_mode: "offline_synced",
        },
      });

      await removeSyncedScan(scan.id);
      syncedCount++;
    } catch (err) {
      console.error("Gagal sync data offline:", scan.id, err);
      failedCount++;
    }
  }

  return { syncedCount, failedCount };
}