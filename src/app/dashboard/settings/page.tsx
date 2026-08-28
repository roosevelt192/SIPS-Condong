"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Settings,
  ArrowLeft,
  MessageSquare,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  BellRing,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const [waEnabled, setWaEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        // Ambil sesi aktif
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        console.log("=== PELACAK USER AUTH ===");
        console.log("User ID:", user?.id);
        console.log("User Email:", user?.email);

        if (user) {
          // Menggunakan select tanpa single/maybeSingle untuk mencegah error 500
          const { data: profiles, error: profError } = await supabase
            .from("profiles")
            .select("role, status")
            .eq("id", user.id)
            .limit(1);

          if (profError) {
            console.error("Supabase Profile Error:", profError.message);
          } else if (profiles && profiles.length > 0) {
            console.log("Profile from DB:", profiles[0]);
            setUserRole(profiles[0].role || "");
          } else {
            console.warn("Profil tidak ditemukan untuk UID:", user.id);
            // Fallback jika email adalah akun developer/admin Anda
            if (user.email === "wezefaiq75@gmail.com") {
              setUserRole("super_admin");
            }
          }
        }

        // Ambil pengaturan sakelar WA
        const { data: settingsData } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "wa_notifications_enabled")
          .limit(1);

        if (settingsData && settingsData.length > 0) {
          setWaEnabled(settingsData[0].value === true);
        }
      } catch (err) {
        console.warn("Gagal memuat setting:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleToggleWhatsApp = async () => {
    if (userRole !== "super_admin") {
      setMessage("Hanya Super Admin yang berhak mengubah konfigurasi ini.");
      return;
    }

    setSaving(true);
    setMessage(null);
    const nextState = !waEnabled;

    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert({
          key: "wa_notifications_enabled",
          value: nextState,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      setWaEnabled(nextState);
      setMessage(
        `Notifikasi WhatsApp berhasil ${nextState ? "DIAKTIFKAN" : "DINONAKTIFKAN"}.`
      );
    } catch (err: any) {
      setMessage("Gagal memperbarui pengaturan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans pb-16">
      {/* Header Banner */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <Link
            href="/dashboard"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition active:scale-95 shadow-sm"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.3]" />
          </Link>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <Settings className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Pengaturan &amp; Integrasi Sistem
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola modul otomatisasi dan notifikasi ke wali santri
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-2xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/40 text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-500" />
          <span>{message}</span>
        </div>
      )}

      {/* Panel Sakelar WhatsApp */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Otomatisasi Notifikasi WhatsApp Wali Santri
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed">
                Jika diaktifkan, sistem akan otomatis mengirimkan pesan WhatsApp ke nomor orang tua/wali setiap kali santri diverifikasi di pos gerbang (keluar atau kembali).
              </p>
            </div>
          </div>

          {/* Sakelar Toggle Switch */}
          {loading ? (
            <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
          ) : (
            <button
              type="button"
              disabled={saving || userRole !== "super_admin"}
              onClick={handleToggleWhatsApp}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 ${
                waEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  waEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          )}
        </div>

        {userRole !== "super_admin" && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300 font-semibold">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
            <span>Hanya akun dengan role Super Admin yang diizinkan mengubah status sakelar ini.</span>
          </div>
        )}
      </div>
    </div>
  );
}