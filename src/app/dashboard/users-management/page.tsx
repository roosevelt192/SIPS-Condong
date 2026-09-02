"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Trash2,
  Edit2,
  RefreshCw,
  ArrowLeft,
  Search,
  Check,
  X,
  Clock,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: "super_admin" | "pengasuhan" | "security";
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export default function UsersManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // State Modal Edit
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"super_admin" | "pengasuhan" | "security">("pengasuhan");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  async function checkSuperAdminAccess() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (!profile || profile.role !== "super_admin") {
        router.replace("/dashboard");
        return;
      }

      fetchUsers();
    } catch {
      router.replace("/dashboard");
    }
  }

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateStatus = async (userId: string, newStatus: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (error) throw error;
      fetchUsers();
    } catch (err: any) {
      alert("Gagal memperbarui status akun: " + err.message);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editName,
          role: editRole,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingUser.id);

      if (error) throw error;
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      alert("Gagal memperbarui data petugas: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus akun petugas "${userName}"?`)) return;

    try {
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      fetchUsers();
    } catch (err: any) {
      alert("Gagal menghapus akun: " + err.message);
    }
  };

  const pendingUsers = users.filter((u) => u.status === "pending");
  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans relative pb-16">
      {/* Background Subtle Glows */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-48 -left-10 h-72 w-72 rounded-full bg-teal-500/10 blur-[100px]" />

      {/* ================= HEADER HERO BANNER ================= */}
      <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-r from-emerald-950 via-[#064e3b] to-teal-950 p-6 sm:p-8 text-white shadow-2xl border border-emerald-500/40">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-emerald-400/20 blur-[80px] pointer-events-none animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-amber-400/20 blur-[80px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/30 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4 min-w-0">
            <Link
              href="/dashboard"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all active:scale-90 shadow-sm backdrop-blur-md"
              title="Kembali ke Dashboard"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
            </Link>

            <div className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-emerald-500 to-teal-400 text-slate-950 shadow-lg font-black">
              <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-400 border-2 border-white dark:border-slate-900 animate-ping" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-emerald-200 text-[10px] font-black uppercase tracking-wider backdrop-blur-xl">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  SUPER ADMIN
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-100 to-amber-300 bg-clip-text text-transparent truncate">
                Manajemen Akun &amp; Otoritas Petugas
              </h1>
              <p className="text-xs text-emerald-100/90 font-medium truncate">
                Verifikasi pendaftaran akun baru, atur hak akses Pengasuhan dan Satpam
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchUsers}
            className="flex h-11 w-11 shrink-0 self-end sm:self-auto items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition active:scale-90 shadow-sm cursor-pointer backdrop-blur-md"
            title="Segarkan Data Petugas"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${loading ? "animate-spin text-amber-300" : ""}`} />
          </button>
        </div>
      </div>

      {/* ANTREAN VERIFIKASI (PENDING) */}
      {pendingUsers.length > 0 && (
        <div className="rounded-[32px] border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-5 sm:p-6 space-y-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5 animate-pulse shrink-0" />
              <h3 className="font-extrabold text-sm sm:text-base">
                Menunggu Persetujuan ({pendingUsers.length} Pendaftar Baru)
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">Verifikasi manual diperlukan</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="p-4 rounded-2xl border border-amber-500/20 bg-white dark:bg-[#0c1815] flex items-center justify-between shadow-sm gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{u.full_name}</p>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase shrink-0 ${
                        u.role === "security"
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      }`}
                    >
                      {u.role === "security" ? "Satpam Gerbang" : "Pengasuhan"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate">{u.email}</p>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(u.id, "approved")}
                    className="p-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition cursor-pointer"
                    title="Setujui Akun"
                  >
                    <Check className="h-4 w-4 stroke-[3]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(u.id, "rejected")}
                    className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition cursor-pointer"
                    title="Tolak Pendaftaran"
                  >
                    <X className="h-4 w-4 stroke-[3]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DAFTAR SEMUA AKUN PETUGAS: RESPONSIVE DUAL-VIEW */}
      <div className="rounded-[32px] border border-slate-200/80 dark:border-emerald-900/40 bg-white/95 dark:bg-[#0c1815] shadow-xl overflow-hidden space-y-4 p-5 sm:p-6 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-emerald-900/30 pb-4">
          <div>
            <h3 className="font-black text-sm text-slate-900 dark:text-white">Daftar Pengguna Terdaftar</h3>
            <p className="text-[11px] text-slate-400">Kelola akun, otoritas peran, dan hak akses sistem</p>
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, email, role..."
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 pl-10 pr-3 text-xs font-semibold outline-none focus:border-emerald-500 transition text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* TAMPILAN 1: MOBILE CARD VIEW (Layar HP < md) */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-emerald-900/30">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-emerald-600 mb-2" />
              <span className="text-xs font-semibold">Memuat daftar petugas...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-semibold">
              Tidak ada petugas yang cocok dengan pencarian.
            </div>
          ) : (
            filteredUsers.map((u) => (
              <div key={u.id} className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-black text-xs shrink-0 shadow-inner">
                      {u.full_name ? u.full_name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{u.full_name}</p>
                      <p className="text-xs text-slate-400 font-mono truncate">{u.email}</p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                      u.status === "approved"
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : u.status === "pending"
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse"
                        : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                    }`}
                  >
                    {u.status === "approved" ? "Aktif" : u.status === "pending" ? "Menunggu" : "Ditolak"}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-emerald-900/30">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                      u.role === "super_admin"
                        ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        : u.role === "security"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {u.role === "super_admin"
                      ? "Super Admin"
                      : u.role === "security"
                      ? "Satpam Gerbang"
                      : "Pengasuhan"}
                  </span>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUser(u);
                        setEditName(u.full_name);
                        setEditRole(u.role);
                      }}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-emerald-900/40 bg-slate-50 dark:bg-emerald-950/40 text-slate-700 dark:text-slate-200 text-xs font-bold transition active:scale-95 cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    {u.role !== "super_admin" && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.id, u.full_name)}
                        className="p-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition active:scale-95 cursor-pointer"
                        title="Hapus Akun"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* TAMPILAN 2: DESKTOP TABLE VIEW (Layar md ke atas) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-emerald-900/40 bg-slate-50/90 dark:bg-emerald-950/40 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                <th className="py-4 px-4 font-bold">Nama Petugas</th>
                <th className="py-4 px-4 font-bold">Email Login</th>
                <th className="py-4 px-4 font-bold">Peran (Role)</th>
                <th className="py-4 px-4 text-center font-bold">Status Akses</th>
                <th className="py-4 px-4 text-center font-bold">Aksi Kelola</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/30 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    <span className="text-xs font-semibold">Memuat daftar petugas...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs font-semibold">
                    Tidak ada petugas yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-950/20 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{u.full_name}</td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono">{u.email}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          u.role === "super_admin"
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            : u.role === "security"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {u.role === "super_admin"
                          ? "Super Admin"
                          : u.role === "security"
                          ? "Satpam Gerbang"
                          : "Pengasuhan"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                          u.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : u.status === "pending"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {u.status === "approved" ? "Aktif" : u.status === "pending" ? "Menunggu" : "Ditolak"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUser(u);
                            setEditName(u.full_name);
                            setEditRole(u.role);
                          }}
                          className="p-2 rounded-xl border border-slate-200 dark:border-emerald-900/40 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/40 transition active:scale-90 cursor-pointer shadow-xs"
                          title="Edit Profil & Role"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {u.role !== "super_admin" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id, u.full_name)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-emerald-900/40 text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:border-rose-500/40 hover:bg-rose-500/10 transition active:scale-90 cursor-pointer shadow-xs"
                            title="Hapus Akun"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-white space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div>
                <h3 className="font-extrabold text-sm text-white">Edit Data Petugas &amp; Peran</h3>
                <p className="text-[11px] text-slate-400">{editingUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Nama Petugas</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-11 rounded-2xl bg-slate-950 border border-slate-800 px-3.5 font-semibold text-white outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Peran Akun (Role)</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full h-11 rounded-2xl bg-slate-950 border border-slate-800 px-3.5 font-bold text-white outline-none focus:border-emerald-500 cursor-pointer transition"
                >
                  <option value="pengasuhan">Bagian Pengasuhan Santri</option>
                  <option value="security">Pos Satpam / Keamanan Gerbang</option>
                  <option value="super_admin">Super Admin (Akses Penuh)</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition active:scale-95 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-2xl bg-emerald-500 text-slate-950 font-black hover:bg-emerald-400 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}