"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Activity,
  ChevronLeft,
  ChevronRight,
  Database,
  SlidersHorizontal,
  Eye,
  X,
  FileCheck2,
  LogOut,
  LogIn,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AuditLogItem {
  id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<"all" | "today" | "7days">("all");
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchLogsAndProfiles = async () => {
    setLoading(true);
    try {
      // 1. Ambil data profiles untuk mapping nama lengkap petugas
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email");
      const pMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => {
        if (p.id) pMap[p.id] = p.full_name;
        if (p.email) pMap[p.email.toLowerCase()] = p.full_name;
      });
      setProfilesMap(pMap);

      // 2. Ambil data audit logs
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.warn("Gagal memuat audit log:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogsAndProfiles();

    // Supabase Realtime Subscription
    const channel = supabase
      .channel("realtime-audit-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        (payload) => {
          setLogs((prev) => [payload.new as AuditLogItem, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Helper menampilkan nama petugas resmi
  const getStaffDisplayName = (log: AuditLogItem) => {
    if (log.user_id && profilesMap[log.user_id]) {
      return profilesMap[log.user_id];
    }
    const emailKey = (log.user_name || "").toLowerCase().trim();
    if (profilesMap[emailKey]) {
      return profilesMap[emailKey];
    }
    if (log.user_name && log.user_name.includes("@")) {
      const username = log.user_name.split("@")[0];
      return username
        .replace(/[._]/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }
    return log.user_name || "Petugas SIPS";
  };

  const stats = useMemo(() => {
    const outCount = logs.filter((l) => l.action === "GATE_SCAN_OUT").length;
    const inCount = logs.filter((l) => l.action === "GATE_SCAN_IN").length;
    const pointCount = logs.filter((l) => l.action === "UPDATE_POINTS").length;
    return { outCount, inCount, pointCount, total: logs.length };
  }, [logs]);

  const formatActionBadge = (action: string) => {
    switch (action) {
      case "GATE_SCAN_OUT":
        return {
          label: "Scan Gerbang: Keluar",
          icon: LogOut,
          cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
        };
      case "GATE_SCAN_IN":
        return {
          label: "Scan Gerbang: Kembali",
          icon: LogIn,
          cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
        };
      case "UPDATE_POINTS":
        return {
          label: "Pembaruan Poin Disiplin",
          icon: SlidersHorizontal,
          cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
        };
      case "DELETE_STUDENT":
        return {
          label: "Penghapusan Data Santri",
          icon: ShieldAlert,
          cls: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
        };
      default:
        return {
          label: action.replace(/_/g, " "),
          icon: Activity,
          cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25",
        };
    }
  };

  const filteredLogs = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    return logs.filter((log) => {
      const q = searchQuery.toLowerCase().trim();
      const staffName = getStaffDisplayName(log).toLowerCase();
      const matchSearch =
        q === "" ||
        staffName.includes(q) ||
        log.user_name.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(q);

      const matchAction =
        actionFilter === "all" || log.action === actionFilter;

      const logTime = new Date(log.created_at).getTime();
      let matchTime = true;
      if (timeRange === "today") matchTime = logTime >= startOfToday;
      if (timeRange === "7days") matchTime = logTime >= sevenDaysAgo;

      return matchSearch && matchAction && matchTime;
    });
  }, [logs, searchQuery, actionFilter, timeRange, profilesMap]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredLogs, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans relative pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-5 sm:p-6 shadow-xl backdrop-blur-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <Link
            href="/dashboard"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition active:scale-95 shadow-sm"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.3]" />
          </Link>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-md shadow-indigo-500/20">
            <ShieldAlert className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Audit Logs &amp; Keamanan Staf
              </h1>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Rekam jejak dan kronologi verifikasi pos gerbang &amp; pengasuhan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Time Range Selector */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => { setTimeRange("all"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === "all"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-black"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => { setTimeRange("today"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === "today"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-black"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => { setTimeRange("7days"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === "7days"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-black"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              7 Hari
            </button>
          </div>

          <button
            type="button"
            onClick={fetchLogsAndProfiles}
            className="flex h-10.5 w-10.5 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition active:scale-95 shadow-xs cursor-pointer"
            title="Segarkan Log Realtime"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${loading ? "animate-spin text-indigo-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* Ringkasan Metrik Cepat */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Aktivitas</p>
            <p className="text-base font-black text-slate-900 dark:text-white">{stats.total}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scan Keluar</p>
            <p className="text-base font-black text-amber-600 dark:text-amber-400">{stats.outCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scan Masuk</p>
            <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{stats.inCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Poin &amp; Disiplin</p>
            <p className="text-base font-black text-rose-600 dark:text-rose-400">{stats.pointCount}</p>
          </div>
        </div>
      </div>

      {/* Toolbar Filter & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari nama staf, santri, atau aksi..."
            className="h-10.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 text-xs font-semibold outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="all">Semua Jenis Aksi</option>
            <option value="GATE_SCAN_OUT">Scan Gerbang: Keluar</option>
            <option value="GATE_SCAN_IN">Scan Gerbang: Kembali</option>
            <option value="UPDATE_POINTS">Ubah Poin Disiplin</option>
            <option value="DELETE_STUDENT">Hapus Santri</option>
          </select>
        </div>
      </div>

      {/* DATA AUDIT LOG: RESPONSIVE DUAL-VIEW */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
        
        {/* TAMPILAN 1: MOBILE CARD VIEW (Layar HP < md) */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
          {loading ? (
            <div className="py-14 text-center text-slate-400">
              <RefreshCw className="h-7 w-7 animate-spin mx-auto text-indigo-500 mb-2" />
              <span className="text-xs font-bold">Sinkronisasi catatan aktivitas...</span>
            </div>
          ) : paginatedLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 p-6 space-y-2">
              <Database className="h-9 w-9 mx-auto opacity-30" />
              <p className="font-bold text-xs">Belum ada riwayat audit log yang tercatat.</p>
              <p className="text-[11px] text-slate-400">Aktivitas gerbang atau pengasuhan akan muncul di sini.</p>
            </div>
          ) : (
            paginatedLogs.map((log) => {
              const badge = formatActionBadge(log.action);
              const Icon = badge.icon;
              const staffName = getStaffDisplayName(log);

              return (
                <div key={log.id} className="p-4 space-y-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0">
                        {staffName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                          {staffName}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.created_at).toLocaleString("id-ID", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[10px] font-bold shrink-0 ${badge.cls}`}>
                      <Icon className="h-3 w-3" />
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  {log.details && (
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                      {log.details.santri_name && (
                        <p className="font-bold text-slate-900 dark:text-white">
                          Santri: {log.details.santri_name}{" "}
                          <span className="font-mono text-[10px] text-slate-400 font-normal">
                            ({log.details.santri_nis || "-"})
                          </span>
                        </p>
                      )}
                      {log.details.kategori && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Keperluan: <span className="font-medium text-slate-700 dark:text-slate-300">{log.details.kategori}</span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 text-xs font-bold transition active:scale-95"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Lihat Rincian</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* TAMPILAN 2: DESKTOP TABLE VIEW (Layar md ke atas) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/75 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 select-none">
                <th className="py-3.5 px-4">Waktu</th>
                <th className="py-3.5 px-4">Petugas</th>
                <th className="py-3.5 px-4">Aksi</th>
                <th className="py-3.5 px-4">Rincian Perizinan</th>
                <th className="py-3.5 px-4 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-slate-400">
                    <RefreshCw className="h-7 w-7 animate-spin mx-auto text-indigo-500 mb-2" />
                    <span className="text-xs font-bold">Sinkronisasi catatan aktivitas...</span>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400 space-y-2">
                    <Database className="h-9 w-9 mx-auto opacity-30" />
                    <p className="font-bold text-xs">Belum ada riwayat audit log yang tercatat.</p>
                    <p className="text-[11px] text-slate-400">Aktivitas gerbang atau pengasuhan akan muncul di sini secara realtime.</p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const badge = formatActionBadge(log.action);
                  const Icon = badge.icon;
                  const staffName = getStaffDisplayName(log);

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition duration-150 group"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {new Date(log.created_at).toLocaleString("id-ID", {
                              dateStyle: "short",
                              timeStyle: "medium",
                            })}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0">
                            {staffName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {staffName}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10.5px] font-bold ${badge.cls}`}>
                          <Icon className="h-3 w-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {log.details ? (
                          <div className="space-y-0.5">
                            {log.details.santri_name && (
                              <p className="font-bold text-slate-900 dark:text-white">
                                {log.details.santri_name}{" "}
                                <span className="font-mono text-[10px] text-slate-400 font-normal">
                                  ({log.details.santri_nis || "NIS: -"})
                                </span>
                              </p>
                            )}
                            {log.details.kategori && (
                              <p className="text-[11px] text-slate-400 truncate max-w-xs">
                                Keperluan: <span className="text-slate-600 dark:text-slate-300 font-medium">{log.details.kategori}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/30 transition active:scale-95 shadow-xs cursor-pointer"
                          title="Lihat Detail Rincian Log"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-5 py-3 text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-950/40">
          <span>
            Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> ({filteredLogs.length} entri)
          </span>
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Dialog Inspeksi Detail Log (Format Bersih & Rinci) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Rincian Aktivitas Petugas</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{selectedLog.id.slice(0, 16)}...</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Informasi Petugas & Aksi */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Nama Petugas</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-xs mt-0.5 block">
                    {getStaffDisplayName(selectedLog)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Jenis Aktivitas</span>
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-xs mt-0.5 block">
                    {formatActionBadge(selectedLog.action).label}
                  </span>
                </div>
              </div>

              {/* Deskripsi Aktivitas Terstruktur */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Detail Rincian:
                </span>

                {selectedLog.details ? (
                  <div className="space-y-1.5 text-xs">
                    {selectedLog.details.santri_name && (
                      <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-1">
                        <span className="text-slate-500">Nama Santri:</span>
                        <span className="font-bold text-slate-900 dark:text-white text-right">
                          {selectedLog.details.santri_name}
                        </span>
                      </div>
                    )}
                    {selectedLog.details.santri_nis && (
                      <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-1">
                        <span className="text-slate-500">Nomor Induk (NIS):</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {selectedLog.details.santri_nis}
                        </span>
                      </div>
                    )}
                    {selectedLog.details.kategori && (
                      <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-1">
                        <span className="text-slate-500">Kategori Izin:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                          {selectedLog.details.kategori}
                        </span>
                      </div>
                    )}
                    {selectedLog.details.status_izin && (
                      <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-1">
                        <span className="text-slate-500">Status Siklus:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 capitalize">
                          {selectedLog.details.status_izin.replace("_", " ")}
                        </span>
                      </div>
                    )}
                    {selectedLog.details.waktu_aktual && (
                      <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-1">
                        <span className="text-slate-500">Waktu Verifikasi:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {new Date(selectedLog.details.waktu_aktual).toLocaleString("id-ID")}
                        </span>
                      </div>
                    )}
                    {typeof selectedLog.details.terlambat === "boolean" && (
                      <div className="flex justify-between pt-0.5">
                        <span className="text-slate-500">Status Ketepatan:</span>
                        <span className={`font-bold ${selectedLog.details.terlambat ? "text-rose-500" : "text-emerald-500"}`}>
                          {selectedLog.details.terlambat ? "⚠️ Terlambat Kembali" : "✓ Tepat Waktu"}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 text-[11px] italic">Tidak ada catatan data tambahan.</p>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>Waktu Log: {new Date(selectedLog.created_at).toLocaleString("id-ID")}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              Tutup Rincian
            </button>
          </div>
        </div>
      )}
    </div>
  );
}