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
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (user) {
          const { data: profiles, error: profError } = await supabase
            .from("profiles")
            .select("role, status")
            .eq("id", user.id)
            .limit(1);

          if (profError) {
            console.error("Supabase Profile Error:", profError.message);
          } else if (profiles && profiles.length > 0) {
            setUserRole(profiles[0].role || "");
          } else if (user.email === "wezefaiq75@gmail.com") {
            setUserRole("super_admin");
          }
        }

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
    <div className="space-y-6 max-w-4xl mx-auto font-sans pb-16 relative">
      {/* Background Subtle Glows */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-48 -left-10 h-72 w-72 rounded-full bg-teal-500/10 blur-[100px]" />

      {/* ================= HEADER HERO BANNER ================= */}
      <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-r from-emerald-950 via-[#064e3b] to-teal-950 p-6 sm:p-8 text-white shadow-2xl border border-emerald-500/40">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-emerald-400/20 blur-[80px] pointer-events-none animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-amber-400/20 blur-[80px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/30 pointer-events-none" />

        <div className="relative z-10 flex items-center space-x-4">
          <Link
            href="/dashboard"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all active:scale-90 shadow-sm backdrop-blur-md"
            title="Kembali ke Dashboard Utama"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
          </Link>

          <div className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-emerald-500 to-teal-400 text-slate-950 shadow-lg font-black">
            <Settings className="h-6 w-6 stroke-[2.3]" />
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-emerald-200 text-[10px] font-black uppercase tracking-wider backdrop-blur-xl">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                SYSTEM &amp; INTEGRATION
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-100 to-amber-300 bg-clip-text text-transparent truncate">
              Pengaturan &amp; Integrasi Sistem
            </h1>
            <p className="text-xs text-emerald-100/90 font-medium truncate">
              Kelola modul otomatisasi dan notifikasi ke wali santri secara terpadu
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-3xl border border-emerald-500/30 bg-emerald-950/40 text-xs font-bold text-emerald-300 flex items-center gap-2.5 animate-in fade-in backdrop-blur-md">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      {/* Panel Sakelar WhatsApp */}
      <div className="rounded-[32px] border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-6 sm:p-7 shadow-xl backdrop-blur-xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-inner">
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
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
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