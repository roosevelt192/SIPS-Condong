"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

type Student = {
  id: string;
  nis: string;
  nisn: string | null;
  full_name: string;
  gender: "male" | "female" | string | null;
  birth_place: string | null;
  birth_date: string | null;
  father_name: string | null;
  mother_name: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  origin: string | null;
  class_name: string | null;
  room: string | null;
  entry_year: number | null;
  address: string | null;
  status: string | null;
  created_at?: string;
  updated_at?: string;
};

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadStudent() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("students")
          .select("*")
          .eq("id", params.id)
          .single();

        if (error) throw error;
        setStudent(data);
      } catch (err: any) {
        console.error("Error load student detail:", err);
        setErrorMessage(err.message || "Data santri tidak ditemukan");
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadStudent();
    }
  }, [params.id]);

  function handleCopyProfile() {
    if (!student) return;
    const textToCopy = `*DATA SANTRI SIPES*\nNama: ${student.full_name}\nNIS: ${student.nis}\nKelas: ${student.class_name || "-"}\nKamar: ${student.room || "-"}\nAsal: ${student.origin || "-"}\nStatus: ${(student.status || "active").toUpperCase()}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    if (!student) return;
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus data santri "${student.full_name}" (NIS: ${student.nis}) secara permanen? Data yang sudah dihapus tidak dapat dipulihkan.`
    );

    if (!confirmDelete) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", student.id);

      if (error) throw error;

      alert("Data santri berhasil dihapus dari database.");
      router.push("/dashboard/students");
    } catch (err: any) {
      console.error("Error deleting student:", err);
      alert(`Gagal menghapus santri: ${err.message || "Terjadi kesalahan"}`);
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block h-9 w-9 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900 mb-3"></div>
          <p className="text-sm font-semibold text-slate-700">Memuat profil lengkap santri...</p>
          <p className="text-xs text-slate-400 mt-0.5">Sistem Informasi Pengasuhan Santri</p>
        </div>
      </main>
    );
  }

  if (errorMessage || !student) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-white p-8 text-center shadow-lg border border-slate-200/80">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 text-2xl mb-4">
            ⚠️
          </div>
          <h2 className="text-lg font-bold text-slate-900">Data Santri Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            {errorMessage || "Data santri yang dicari mungkin telah dihapus atau tautan tidak valid."}
          </p>
          <Link
            href="/dashboard/students"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-6 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-95"
          >
            Kembali ke Database Santri
          </Link>
        </div>
      </main>
    );
  }

  const statusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return {
          bg: "bg-emerald-500/10",
          text: "text-emerald-400",
          border: "border-emerald-500/30",
          dot: "bg-emerald-400 animate-pulse",
          label: "AKTIF MUKIM",
        };
      case "alumni":
        return {
          bg: "bg-slate-500/20",
          text: "text-slate-300",
          border: "border-slate-500/30",
          dot: "bg-slate-400",
          label: "ALUMNI / LULUS",
        };
      case "mutasi":
        return {
          bg: "bg-amber-500/10",
          text: "text-amber-400",
          border: "border-amber-500/30",
          dot: "bg-amber-400",
          label: "MUTASI / PINDAH",
        };
      case "nonactive":
      default:
        return {
          bg: "bg-rose-500/10",
          text: "text-rose-400",
          border: "border-rose-500/30",
          dot: "bg-rose-400",
          label: "NONAKTIF / SKORSING",
        };
    }
  };

  const badge = statusBadge(student.status || "active");
  const cleanPhone = student.guardian_phone?.replace(/[^0-9]/g, "");
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone}`
    : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 text-slate-800 antialiased pb-24">
      
      {/* HEADER WITH GLASS EFFECT */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md transition-all shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            
            <div className="flex items-center gap-3.5">
              <Link
                href="/dashboard/students"
                title="Kembali ke Database Santri"
                className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-0.5"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    Profil Santri
                  </h1>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    MASTER REKOR
                  </span>
                </div>
                <p className="text-xs text-slate-500 sm:text-sm">
                  Sistem Informasi Pengasuhan Santri (SIPES)
                </p>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-sm shadow-rose-600/20 transition-all duration-200 hover:bg-rose-700 hover:shadow-md active:scale-95 disabled:opacity-50"
              >
                {deleting ? "Menghapus..." : "Hapus"}
              </button>

              <Link
                href={`/dashboard/students/${student.id}/edit`}
                className="group inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-xs font-bold text-white shadow-sm shadow-slate-900/20 transition-all duration-200 hover:bg-slate-800 hover:shadow-md active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5 text-slate-200 transition-transform group-hover:scale-110"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span>Edit Data</span>
              </Link>
            </div>

          </div>
        </div>
      </header>

      {/* BODY CONTENT */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
        
        {/* HERO DIGITAL ID CARD */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-slate-950/15 border border-slate-800">
          
          {/* Subtle Background Mesh Motif */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl"></div>
          <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"></div>

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            
            {/* Avatar & Profile Details */}
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="relative flex h-18 w-18 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 text-3xl font-black text-white shadow-inner border border-slate-700/80">
                <span>{student.full_name.charAt(0).toUpperCase()}</span>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${student.gender === "female" ? "bg-rose-400" : "bg-blue-400"}`}></span>
                  <span className={`relative inline-flex rounded-full h-4 w-4 border-2 border-slate-900 ${student.gender === "female" ? "bg-rose-500" : "bg-blue-500"}`}></span>
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {student.full_name}
                  </h2>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[11px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}></span>
                    {badge.label}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300">
                  <span className="rounded-lg bg-slate-800/80 px-2.5 py-1 border border-slate-700 text-slate-200">
                    NIS: <strong>{student.nis}</strong>
                  </span>
                  {student.nisn && (
                    <span className="rounded-lg bg-slate-800/80 px-2.5 py-1 border border-slate-700 text-slate-300">
                      NISN: {student.nisn}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Share / Copy Button */}
            <button
              type="button"
              onClick={handleCopyProfile}
              className="group inline-flex items-center gap-2 rounded-xl bg-slate-800/90 px-4 py-2.5 text-xs font-bold text-slate-200 border border-slate-700 shadow-sm transition hover:bg-slate-700 hover:text-white active:scale-95 self-stretch sm:self-auto justify-center"
            >
              {copied ? (
                <>
                  <span className="text-emerald-400">✓</span>
                  <span className="text-emerald-400">Profil Tersalin!</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:scale-110">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  <span>Salin Ringkasan</span>
                </>
              )}
            </button>

          </div>
        </div>

        {/* QUICK STATS CHIPS (4 CARDS) */}
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4 sm:gap-4">
          
          <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kelas Aktif</span>
            <p className="mt-1 text-lg font-black text-slate-900 truncate">
              {student.class_name ? `Kelas ${student.class_name}` : "-"}
            </p>
          </div>

          <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kamar / Asrama</span>
            <p className="mt-1 text-lg font-black text-slate-900 truncate">
              {student.room || "-"}
            </p>
          </div>

          <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Asal Konsulat</span>
            <p className="mt-1 text-lg font-black text-slate-900 truncate">
              {student.origin || "-"}
            </p>
          </div>

          <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Angkatan Masuk</span>
            <p className="mt-1 text-lg font-black text-slate-900 truncate">
              {student.entry_year ? `Tahun ${student.entry_year}` : "-"}
            </p>
          </div>

        </div>

        {/* SECTION 1: DATA PERSONAL & KELAHIRAN */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-700 text-xs">1</span>
              <span>Identitas Personal & Kelahiran</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
            <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-100/80">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase">Jenis Kelamin</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-bold text-slate-800 text-sm">
                  {student.gender === "male" ? "Banin (Laki-laki)" : student.gender === "female" ? "Banat (Perempuan)" : "-"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-100/80">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase">Tempat Lahir</span>
              <span className="font-bold text-slate-800 text-sm mt-1 block truncate">
                {student.birth_place || "-"}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-100/80">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase">Tanggal Lahir</span>
              <span className="font-bold text-slate-800 text-sm mt-1 block">
                {student.birth_date
                  ? new Date(student.birth_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: DATA KELUARGA & KONTAK WALI */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-700 text-xs">2</span>
              <span>Data Keluarga & Kontak Wali</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
            <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-100/80">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase">Nama Ayah</span>
              <span className="font-bold text-slate-800 text-sm mt-1 block truncate">{student.father_name || "-"}</span>
            </div>

            <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-100/80">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase">Nama Ibu</span>
              <span className="font-bold text-slate-800 text-sm mt-1 block truncate">{student.mother_name || "-"}</span>
            </div>

            <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-100/80">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase">Nama Wali</span>
              <span className="font-bold text-slate-800 text-sm mt-1 block truncate">{student.guardian_name || "-"}</span>
            </div>

            <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-100/80 flex flex-col justify-between">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Kontak / WhatsApp</span>
                <span className="font-bold text-slate-800 text-sm mt-1 block font-mono">
                  {student.guardian_phone || "-"}
                </span>
              </div>
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition"
                >
                  <span>Chat WhatsApp</span>
                  <span>→</span>
                </a>
              )}
            </div>

            <div className="sm:col-span-2 lg:col-span-4 rounded-2xl bg-slate-50/80 p-4 border border-slate-100/80">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase">Alamat Lengkap Rumah</span>
              <p className="font-semibold text-slate-800 text-xs mt-1.5 leading-relaxed">{student.address || "-"}</p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}