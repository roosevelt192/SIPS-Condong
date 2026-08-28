"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Trophy,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  User,
  Send,
  Award,
  Medal,
  BookOpen,
  Globe2,
  IdCard,
  UploadCloud,
  FileText,
  FileCheck,
  Paperclip,
  ExternalLink,
  Edit3,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface Student {
  id: string;
  nis: string;
  nisn: string;
  name: string;
  gender: string;
  pob: string;
  dob: string;
  class: string;
  dorm: string;
  entry_year: string;
  consulate: string;
  guardian_name: string;
  guardian_phone: string;
  address: string;
  photo_url?: string | null;
  status: string;
  points: number;
}

const PRESET_ACHIEVEMENTS = [
  {
    title: "Juara 1 Musabaqah Hifdzil Quran (MHQ) 10 Juz",
    category: "Tahfidz / Al-Quran",
    level: "Kabupaten / Kota",
    points: 30,
    icon: BookOpen,
    appreciation: "Piagam Emas & Beasiswa SPP 3 Bulan",
    activeBorder: "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/30",
  },
  {
    title: "Juara 1 Lomba Pidato Bahasa Arab (Khitobah)",
    category: "Bahasa / Pidato",
    level: "Provinsi",
    points: 40,
    icon: Sparkles,
    appreciation: "Piala Bergilir & Bebas Izin Khusus Pulang",
    activeBorder: "border-teal-500 bg-teal-500/10 text-teal-800 dark:text-teal-300 ring-2 ring-teal-500/30",
  },
  {
    title: "Medali Emas Olimpiade Sains & Matematika Pesantren",
    category: "Akademik & Sains",
    level: "Nasional",
    points: 50,
    icon: Trophy,
    appreciation: "Sertifikat Nasional & Tabungan Prestasi Santri",
    activeBorder: "border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/30",
  },
  {
    title: "Teladan Disiplin & Penggerak Shalat Berjamaah Asrama",
    category: "Keorganisasian & Kepemimpinan",
    level: "Internal Pondok",
    points: 20,
    icon: Award,
    appreciation: "Lencana Santri Teladan Bulanan",
    activeBorder: "border-cyan-500 bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 ring-2 ring-cyan-500/30",
  },
  {
    title: "Juara Umum Turnamen Pencak Silat / Olahraga Pondok",
    category: "Olahraga & Seni",
    level: "Kabupaten / Kota",
    points: 25,
    icon: Medal,
    appreciation: "Medali Kehormatan & Seragam Kontingen",
    activeBorder: "border-orange-500 bg-orange-500/10 text-orange-800 dark:text-orange-300 ring-2 ring-orange-500/30",
  },
  {
    title: "Juara 1 Debat Bahasa Inggris Antar Pesantren (English Debate)",
    category: "Bahasa / Pidato",
    level: "Nasional",
    points: 50,
    icon: Globe2,
    appreciation: "Piagam Penghargaan Direktur & Uang Pembinaan",
    activeBorder: "border-blue-500 bg-blue-500/10 text-blue-800 dark:text-blue-300 ring-2 ring-blue-500/30",
  },
];

export default function EditAchievementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const achievementId = resolvedParams.id;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Tahfidz / Al-Quran");
  const [level, setLevel] = useState("Kabupaten / Kota");
  const [rewardPoints, setRewardPoints] = useState<number>(25);
  const [appreciation, setAppreciation] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));

  // Certificate states
  const [existingCertUrl, setExistingCertUrl] = useState<string | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const mapStudentData = (s: any): Student => ({
    id: s.id,
    nis: s.nis || "-",
    nisn: s.nisn || "-",
    name: s.full_name || s.name || s.nama || "Santri",
    gender: s.gender || "-",
    pob: s.tempat_lahir || s.pob || "-",
    dob: s.tanggal_lahir || s.dob || "-",
    class: s.kelas || s.class_name || s.class || "-",
    dorm: s.kamar_asrama || s.dorm || s.room || s.asrama || "-",
    entry_year: s.tahun_masuk || s.entry_year || "2026",
    consulate: s.asal_konsulat || s.consulate || s.origin_region || "-",
    guardian_name: s.nama_lengkap_wali || s.guardian_name || "-",
    guardian_phone: s.no_whatsapp || s.guardian_phone || s.parent_phone || "-",
    address: s.alamat_lengkap || s.address || "-",
    photo_url: s.photo_url || s.foto || null,
    status: s.status_santri || s.status || "Aktif",
    points: Number(s.poin_disiplin || s.points) || 0,
  });

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // 1. Ambil data prestasi
        const { data: aData, error: aError } = await supabase
          .from("achievements")
          .select("*")
          .eq("id", achievementId)
          .single();

        if (aError) throw aError;
        if (!aData) throw new Error("Catatan prestasi tidak ditemukan.");

        setTitle(aData.title || "");
        setCategory(aData.category || "Tahfidz / Al-Quran");
        setLevel(aData.level || "Kabupaten / Kota");
        setRewardPoints(Number(aData.reward_points) || 25);
        setAppreciation(aData.appreciation || "");
        setDescription(aData.description || "");
        setEventDate(aData.event_date || new Date().toISOString().slice(0, 10));
        setExistingCertUrl(aData.certificate_url || null);

        // 2. Ambil data santri terkait
        if (aData.student_id) {
          const { data: sData } = await supabase
            .from("students")
            .select("*")
            .eq("id", aData.student_id)
            .single();

          if (sData) setStudent(mapStudentData(sData));
        } else if (aData.nis) {
          const { data: sData } = await supabase
            .from("students")
            .select("*")
            .eq("nis", aData.nis)
            .single();

          if (sData) setStudent(mapStudentData(sData));
        }
      } catch (err: any) {
        setErrorMessage("Gagal memuat data: " + err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [achievementId]);

  const applyPreset = (preset: typeof PRESET_ACHIEVEMENTS[0]) => {
    setTitle(preset.title);
    setCategory(preset.category);
    setLevel(preset.level);
    setRewardPoints(preset.points);
    setAppreciation(preset.appreciation);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Nama kejuaraan / prestasi wajib diisi.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      let certificateUrl = existingCertUrl;
      let certificateName: string | undefined = undefined;

      if (newFile && student) {
        setUploadingFile(true);
        const fileExt = newFile.name.split(".").pop();
        const cleanName = newFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `certificates/${student.nis}_${Date.now()}_${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from("achievement-certificates")
          .upload(filePath, newFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from("achievement-certificates")
            .getPublicUrl(filePath);

          certificateUrl = publicUrlData?.publicUrl || certificateUrl;
          certificateName = newFile.name;
        }
      }

      const payload: any = {
        title: title.trim(),
        category,
        level,
        reward_points: Number(rewardPoints),
        appreciation: appreciation.trim(),
        description: description.trim(),
        event_date: eventDate,
        certificate_url: certificateUrl,
      };

      if (certificateName) {
        payload.certificate_name = certificateName;
      }

      const { error } = await supabase
        .from("achievements")
        .update(payload)
        .eq("id", achievementId);

      if (error) throw error;

      router.push("/dashboard/achievements");
      router.refresh();
    } catch (err: any) {
      setErrorMessage("Gagal memperbarui catatan prestasi: " + err.message);
      setSubmitting(false);
      setUploadingFile(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500">Memuat data capaian prestasi santri...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 font-sans relative">
      {/* Dynamic Background Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-10 h-[550px] w-[550px] rounded-full bg-emerald-500/15 blur-[160px]" />
        <div className="absolute bottom-10 left-10 h-[450px] w-[450px] rounded-full bg-amber-500/15 blur-[150px]" />
      </div>

      {/* HEADER BANNER */}
      <div className="relative overflow-hidden rounded-[32px] border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/achievements"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-emerald-500 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all duration-200 active:scale-90 shadow-sm"
            title="Kembali ke Daftar Prestasi"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
          </Link>

          <div className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 via-emerald-500/20 to-teal-500/20 text-emerald-500 border border-emerald-500/30 shadow-inner">
            <Edit3 className="h-6 w-6 stroke-[2.3] text-emerald-500" />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Edit Catatan Prestasi Santri
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" /> Modifikasi Data
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Perbarui rincian capaian lomba, bobot reward poin, apresiasi, serta berkas piagam
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/achievements"
            className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
          >
            Batalkan
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="group relative inline-flex items-center space-x-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500 px-7 py-3.5 text-xs sm:text-sm font-black text-white shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.03] active:scale-95 transition-all duration-300 disabled:opacity-50 overflow-hidden cursor-pointer"
          >
            <Send className="h-4 w-4 stroke-[2.5]" />
            <span>
              {submitting
                ? uploadingFile
                  ? "Mengunggah Piagam..."
                  : "Menyimpan Perubahan..."
                : "Simpan Perubahan"}
            </span>
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/70 p-4 text-xs font-bold text-rose-200 flex items-center gap-3 animate-in fade-in shadow-xl backdrop-blur-xl">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
        </div>
      )}

      {/* 2-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KOLOM KIRI: KARTU IDENTITAS SANTRI TERKAIT */}
        <div className="lg:col-span-5 space-y-6">
          {student ? (
            <div className="relative overflow-hidden rounded-[28px] border-2 border-emerald-500/40 bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300">
              {/* Header Pita Kartu */}
              <div className="relative bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500 px-6 py-4 text-white overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-white/10 skew-x-12 pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <h3 className="text-sm font-black tracking-widest uppercase shadow-sm flex items-center gap-1.5">
                      <IdCard className="h-4 w-4" /> KARTU TANDA SANTRI (KTS)
                    </h3>
                    <p className="text-[10px] font-bold text-emerald-100 tracking-wider mt-0.5">
                      TAHUN MASUK: {student.entry_year || "2026"}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase border border-white/20">
                    Santri Terkait
                  </span>
                </div>
              </div>

              {/* Badan Kartu */}
              <div className="p-6 bg-slate-50/50 dark:bg-slate-900/60 relative">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
                  <div className="relative h-[180px] w-[135px] shrink-0 rounded-2xl overflow-hidden border-[5px] border-white dark:border-slate-800 bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-xl">
                    {student.photo_url ? (
                      <Image
                        src={student.photo_url}
                        alt={student.name}
                        fill
                        unoptimized
                        sizes="160px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-white bg-slate-800">
                        <User className="h-16 w-16 stroke-[1.2]" />
                        <span className="text-[10px] font-bold mt-2 uppercase text-slate-400">
                          No Photo
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-3 text-xs text-slate-800 dark:text-slate-200">
                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-4 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px]">
                        Nomor (NIS)
                      </span>
                      <span className="col-span-1 text-center font-bold text-slate-400">:</span>
                      <span className="col-span-7 font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm leading-none">
                        {student.nis || "-"}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-4 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px]">
                        Nama Lengkap
                      </span>
                      <span className="col-span-1 text-center font-bold text-slate-400">:</span>
                      <span className="col-span-7 font-black text-slate-900 dark:text-white uppercase leading-tight">
                        {student.name}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-4 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px]">
                        Kelas / Jenjang
                      </span>
                      <span className="col-span-1 text-center font-bold text-slate-400">:</span>
                      <span className="col-span-7 font-extrabold text-slate-800 dark:text-slate-200">
                        {student.class || "-"}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-4 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px]">
                        Kamar / Asrama
                      </span>
                      <span className="col-span-1 text-center font-bold text-slate-400">:</span>
                      <span className="col-span-7 font-extrabold text-slate-800 dark:text-slate-200">
                        {student.dorm || "-"}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-4 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px]">
                        Konsulat / Asal
                      </span>
                      <span className="col-span-1 text-center font-bold text-slate-400">:</span>
                      <span className="col-span-7 font-bold text-slate-700 dark:text-slate-300 line-clamp-2">
                        {student.consulate || "-"}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-4 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px]">
                        Kontak Wali
                      </span>
                      <span className="col-span-1 text-center font-bold text-slate-400">:</span>
                      <span className="col-span-7 font-mono font-medium text-slate-600 dark:text-slate-400">
                        {student.guardian_phone || "-"}
                        {student.guardian_name && student.guardian_name !== "-"
                          ? ` (${student.guardian_name})`
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Pita Kartu */}
              <div className="bg-slate-100 dark:bg-slate-950 px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-amber-500" /> SIPS PESANTREN
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Status: {student.status || "Aktif Mukim"}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-8 text-center text-slate-400">
              <p className="font-bold text-xs">Identitas Santri Terhubung</p>
            </div>
          )}
        </div>

        {/* KOLOM KANAN: FORM EDIT PRESTASI */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-[32px] border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">
                  2
                </div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Ubah Rincian Prestasi
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500 text-white shadow-emerald-500/30 shadow-md">
                  +{rewardPoints} Poin Apresiasi
                </span>
              </div>
            </div>

            {/* PRESET STANDAR PONDOK */}
            <div className="space-y-2.5">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Preset Prestasi Pesantren
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  Klik opsi untuk mengganti cepat
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_ACHIEVEMENTS.map((p, idx) => {
                  const Icon = p.icon;
                  const isActive = title === p.title;
                  return (
                    <div
                      key={idx}
                      onClick={() => applyPreset(p)}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 select-none relative overflow-hidden group ${
                        isActive
                          ? `${p.activeBorder} shadow-lg scale-[1.02]`
                          : "bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-700 hover:scale-[1.01]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Icon
                            className={`h-4 w-4 ${
                              isActive ? "text-emerald-500" : "text-amber-500"
                            }`}
                          />
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider ${
                              isActive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-400"
                            }`}
                          >
                            {p.level}
                          </span>
                        </div>
                        <span className="text-xs font-black text-emerald-500">
                          +{p.points} Poin
                        </span>
                      </div>
                      <p className="text-xs font-bold mt-2 leading-snug">{p.title}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FORM INPUT FIELDS */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Nama Kejuaraan / Capaian Prestasi *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Juara 1 Lomba Pidato Bahasa Arab Tingkat Provinsi"
                  className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Kategori Bidang
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="Tahfidz / Al-Quran">Tahfidz / Al-Quran</option>
                    <option value="Bahasa / Pidato">Bahasa / Pidato</option>
                    <option value="Akademik & Sains">Akademik & Sains</option>
                    <option value="Keorganisasian & Kepemimpinan">Keorganisasian</option>
                    <option value="Olahraga & Seni">Olahraga & Seni</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Tingkat Wilayah
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="Internal Pondok">Internal Pondok</option>
                    <option value="Kabupaten / Kota">Kabupaten / Kota</option>
                    <option value="Provinsi">Provinsi</option>
                    <option value="Nasional">Nasional</option>
                    <option value="Internasional">Internasional</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Reward Poin (+)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={rewardPoints}
                    onChange={(e) => setRewardPoints(Number(e.target.value))}
                    className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-xs font-black text-emerald-500 outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Bentuk Hadiah / Apresiasi Khusus
                  </label>
                  <input
                    type="text"
                    value={appreciation}
                    onChange={(e) => setAppreciation(e.target.value)}
                    placeholder="Contoh: Piagam Emas, Uang Pembinaan, Beban SPP Bebas"
                    className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Tanggal Perolehan
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Keterangan Tambahan / Penyelenggara Acara (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan nama instansi penyelenggara, lokasi lomba, atau catatan dewan juri..."
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-emerald-500 custom-scrollbar transition-all"
                />
              </div>

              {/* DOKUMEN PIAGAM / SERTIFIKAT */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-emerald-500" />
                  Berkas Piagam / Sertifikat Terlampir
                </label>

                {existingCertUrl && (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <div className="flex items-center space-x-3">
                      <FileCheck className="h-5 w-5 text-emerald-500" />
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Piagam Tersimpan Sebelumnya
                        </p>
                        <a
                          href={existingCertUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          Lihat Piagam Penghargaan <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload Pengganti Piagam */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 rounded-2xl p-4 text-center bg-slate-50/50 dark:bg-slate-950/50 hover:bg-emerald-50/20 transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setNewFile(e.target.files[0]);
                    }}
                    className="hidden"
                  />
                  <UploadCloud className="h-6 w-6 mx-auto text-slate-400" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
                    {newFile
                      ? `Berkas baru terpilih: ${newFile.name}`
                      : "Klik untuk mengunggah piagam / sertifikat baru (pengganti)"}
                  </p>
                </div>
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <Link
                href="/dashboard/achievements"
                className="px-6 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
              >
                Batalkan
              </Link>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="group relative inline-flex items-center space-x-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500 px-8 py-3.5 text-xs sm:text-sm font-black text-white shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.03] active:scale-95 transition-all duration-300 disabled:opacity-50 overflow-hidden cursor-pointer"
              >
                <Send className="h-4 w-4 stroke-[2.5]" />
                <span>
                  {submitting
                    ? uploadingFile
                      ? "Mengunggah..."
                      : "Menyimpan..."
                    : "Simpan Perubahan"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}