"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  Trash2,
  Edit2,
  RefreshCw,
  ArrowLeft,
  Search,
  Check,
  X,
  Shield,
  Clock,
  AlertTriangle,
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
    <div className="space-y-6 max-w-7xl mx-auto font-sans relative pb-12">
      {/* HEADER UTAMA */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <Link
            href="/dashboard"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-500 transition active:scale-95 shadow-sm"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.3]" />
          </Link>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
            <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Manajemen Akun & Otoritas Petugas
              </h1>
              <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-cyan-500 border border-cyan-500/20">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verifikasi pendaftaran akun baru, atur hak akses Pengasuhan dan Satpam
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-500" : ""}`} />
        </button>
      </div>

      {/* ANTREAN VERIFIKASI (PENDING) */}
      {pendingUsers.length > 0 && (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5 animate-pulse" />
              <h3 className="font-extrabold text-sm sm:text-base">
                Menunggu Persetujuan Masuk ({pendingUsers.length} Pendaftar Baru)
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-400">Verifikasi manual diperlukan</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="p-4 rounded-2xl border border-amber-500/20 bg-white dark:bg-slate-900 flex items-center justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{u.full_name}</p>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        u.role === "security"
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-cyan-500/10 text-cyan-500"
                      }`}
                    >
                      {u.role === "security" ? "Satpam Gerbang" : "Pengasuhan"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{u.email}</p>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(u.id, "approved")}
                    className="p-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition"
                    title="Setujui Akun"
                  >
                    <Check className="h-4 w-4 stroke-[3]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(u.id, "rejected")}
                    className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition"
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

      {/* TABEL SEMUA AKUN PETUGAS */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xl overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-black text-sm text-slate-900 dark:text-white">Daftar Pengguna Terdaftar</h3>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, email, role..."
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-10 pr-3 text-xs font-semibold outline-none focus:border-cyan-500 transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase font-bold text-slate-400">
                <th className="py-3 px-4">Nama Petugas</th>
                <th className="py-3 px-4">Email Login</th>
                <th className="py-3 px-4">Peran (Role)</th>
                <th className="py-3 px-4 text-center">Status Akses</th>
                <th className="py-3 px-4 text-center">Aksi Kelola</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{u.full_name}</td>
                  <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono">{u.email}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        u.role === "super_admin"
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          : u.role === "security"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
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
                          ? "bg-emerald-500/10 text-emerald-400"
                          : u.status === "pending"
                          ? "bg-amber-500/10 text-amber-400 animate-pulse"
                          : "bg-rose-500/10 text-rose-400"
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
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-cyan-400 transition"
                        title="Edit Profil & Role"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {u.role !== "super_admin" && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id, u.full_name)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-400 transition"
                          title="Hapus Akun"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm">Edit Data Petugas & Peran</h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white"
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
                  className="w-full h-11 rounded-2xl bg-slate-950 border border-slate-800 px-3.5 font-semibold text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Peran Akun (Role)</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full h-11 rounded-2xl bg-slate-950 border border-slate-800 px-3.5 font-bold text-white outline-none focus:border-cyan-500"
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
                  className="flex-1 py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-2xl bg-cyan-500 text-slate-950 font-black hover:bg-cyan-400 transition"
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