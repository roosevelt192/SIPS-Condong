"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  User,
  School,
  Home,
  MapPin,
  Phone,
  Sparkles,
  Camera,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function EditStudentPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params?.id as string;

  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Foto Profil State
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State (100% Selaras dengan Tambah Data)
  const [formData, setFormData] = useState({
    name: "",
    nis: "",
    gender: "Laki-laki",
    nisn: "",
    pob: "",
    dob: "",
    class: "",
    dorm: "",
    entry_year: "2026",
    consulate: "Konsulat Tasikmalaya",
    guardian_name: "",
    guardian_phone: "",
    address: "",
    status: "active",
    points: 100,
  });

  // Fetch Data Santri Saat Halaman Dimuat
  useEffect(() => {
    if (studentId) {
      fetchStudentData(studentId);
    }
  }, [studentId]);

  async function fetchStudentData(id: string) {
    setPageLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name:
            data.nama_lengkap ||
            data.name ||
            data.nama_santri ||
            data.full_name ||
            data.nama ||
            "",
          nis: data.nis || data.nomor_induk || "",
          gender:
            data.jenis_kelamin === "Perempuan" ||
            data.jenis_kelamin === "Banat (Perempuan / Putri)" ||
            data.gender === "female" ||
            data.gender === "Perempuan" ||
            data.gender === "P"
              ? "Perempuan"
              : "Laki-laki",
          nisn: data.nisn === "-" ? "" : data.nisn || "",
          pob: data.tempat_lahir === "-" ? "" : data.tempat_lahir || data.pob || "",
          dob: data.tanggal_lahir === "-" ? "" : data.tanggal_lahir || data.dob || "",
          class: data.kelas || data.class || data.class_name || data.rombel || "",
          dorm: data.kamar_asrama === "-" ? "" : data.kamar_asrama || data.dorm || "",
          entry_year: String(data.tahun_masuk || data.entry_year || "2026"),
          consulate:
            data.asal_konsulat ||
            data.konsulat ||
            data.consulate ||
            data.kota_asal ||
            "Konsulat Tasikmalaya",
          guardian_name:
            data.nama_lengkap_wali ||
            data.nama_wali ||
            data.guardian_name ||
            data.parent_name ||
            "",
          guardian_phone:
            data.no_whatsapp === "-"
              ? ""
              : data.no_whatsapp || data.no_telepon || data.guardian_phone || data.phone || "",
          address: data.alamat_lengkap === "-" ? "" : data.alamat_lengkap || data.address || "",
          status:
            data.status_santri === "Non-Aktif" ||
            data.status === "inactive" ||
            data.status === "non-aktif"
              ? "inactive"
              : "active",
          points: data.poin_disiplin ?? data.points ?? data.poin ?? 100,
        });

        const existingPhoto =
          data.photo_url || data.avatar_url || data.foto || data.image_url || data.photo || null;
        if (existingPhoto) {
          setPhotoPreview(existingPhoto);
        }
      }
    } catch (err: any) {
      setErrorMessage("Gagal memuat data santri: " + err.message);
    } finally {
      setPageLoading(false);
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Harap pilih file gambar (JPG, PNG, WEBP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage("Ukuran gambar maksimal 2MB.");
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setErrorMessage("");
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    if (!formData.name.trim()) {
      setErrorMessage("Nama lengkap santri wajib diisi.");
      setLoading(false);
      return;
    }
    if (!formData.nis.trim()) {
      setErrorMessage("Nomor Induk Santri (NIS) wajib diisi.");
      setLoading(false);
      return;
    }
    if (!formData.class.trim()) {
      setErrorMessage("Kelas / Rombel wajib diisi.");
      setLoading(false);
      return;
    }

    try {
      let uploadedPhotoUrl = photoPreview || "";
      if (photoFile) {
        try {
          const fileExt = photoFile.name.split(".").pop();
          const fileName = `${formData.nis.trim() || Date.now()}_${Date.now()}.${fileExt}`;
          const filePath = `avatars/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("student-photos")
            .upload(filePath, photoFile, { upsert: true });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from("student-photos")
              .getPublicUrl(filePath);
            uploadedPhotoUrl = publicUrlData.publicUrl;
          }
        } catch {
          uploadedPhotoUrl = photoPreview || "";
        }
      }

      const { data: sampleRowData, error: sampleErr } = await supabase
        .from("students")
        .select("*")
        .limit(1);

      if (sampleErr) throw sampleErr;

      const existingDbKeys: string[] =
        sampleRowData && sampleRowData[0] ? Object.keys(sampleRowData[0]) : [];

      const studentPayload: any = {};

      const setField = (possibleKeys: string[], val: any) => {
        if (existingDbKeys.length > 0) {
          const foundKey = possibleKeys.find((k) => existingDbKeys.includes(k));
          if (foundKey) studentPayload[foundKey] = val;
        } else {
          studentPayload[possibleKeys[0]] = val;
        }
      };

      setField(["nis", "nomor_induk"], formData.nis.trim());
      setField(["nisn"], formData.nisn.trim() || "-");
      setField(["nama_lengkap", "name", "nama_santri", "nama", "full_name"], formData.name.trim());
      setField(["jenis_kelamin", "gender"], formData.gender);
      setField(["tempat_lahir", "pob", "birth_place"], formData.pob.trim() || "-");
      setField(["tanggal_lahir", "dob", "birth_date"], formData.dob || "-");
      setField(["kelas", "class_name", "rombel", "tingkat", "class"], formData.class.trim());
      setField(["kamar_asrama", "asrama", "dorm", "rayon", "kamar"], formData.dorm.trim() || "-");
      setField(["tahun_masuk", "entry_year"], formData.entry_year.trim() || "2026");
      setField(["asal_konsulat", "konsulat", "consulate", "kota_asal"], formData.consulate.trim());
      setField(
        ["nama_lengkap_wali", "nama_wali", "guardian_name", "parent_name"],
        formData.guardian_name.trim() || "Wali Santri"
      );
      setField(
        ["no_whatsapp", "no_telepon", "no_hp", "guardian_phone", "phone"],
        formData.guardian_phone.trim() || "-"
      );
      setField(["alamat_lengkap", "alamat", "address"], formData.address.trim() || "-");
      setField(
        ["status_santri", "status"],
        formData.status === "active" ? "Aktif Mukim" : "Non-Aktif"
      );
      setField(["poin_disiplin", "poin", "points", "point"], Number(formData.points) || 100);

      if (uploadedPhotoUrl) {
        setField(["photo_url", "avatar_url", "foto", "image_url", "photo"], uploadedPhotoUrl);
      }

      const { error: updateError } = await supabase
        .from("students")
        .update(studentPayload)
        .eq("id", studentId);

      if (updateError) throw updateError;

      setSuccessMessage("Perubahan data santri berhasil disimpan!");
      setTimeout(() => {
        router.push("/dashboard/students");
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memperbarui data santri.");
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-cyan-500" />
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Memuat berkas santri dari database SIPS...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans relative pb-12">
      {/* Background Ambient Glow */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-40 -left-10 h-72 w-72 rounded-full bg-teal-500/10 blur-[100px]" />

      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-r from-white via-slate-50/50 to-white dark:from-slate-900/90 dark:via-slate-900/40 dark:to-slate-900/90 p-5 sm:p-6 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative z-10">
          <div className="flex items-center space-x-3">
            <Link
              href="/dashboard/students"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-cyan-500/50 hover:text-cyan-500 transition active:scale-95 shadow-sm"
              title="Kembali ke Database Santri"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Edit Data Santri
                </h1>
                
               
                
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Perbarui foto identitas, biodata santri, penempatan asrama, kelas, dan data wali
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Notifikasi */}
      {errorMessage && (
        <div className="flex items-center space-x-2.5 rounded-2xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs font-semibold text-rose-700 dark:text-rose-300 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center space-x-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage} Mengalihkan ke database...</span>
        </div>
      )}

      {/* Form Edit Santri */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* BAGIAN 1: FOTO & IDENTITAS POKOK SANTRI */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 p-5 sm:p-6 shadow-sm space-y-6">
          <div className="flex items-center space-x-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500 font-bold text-xs">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                1. IDENTITAS POKOK SANTRI
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Unggah pas foto resmi dan lengkapi data diri santri
              </p>
            </div>
          </div>

          {/* Area Pas Foto Rasio 3:4 */}
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />

            {/* Avatar Preview (Rasio 3:4 Pas Foto Formal) */}
            <div className="relative group shrink-0">
              <div className="w-24 h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-900 shadow-inner">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Pratinjau Foto"
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                    <ImageIcon className="h-7 w-7 stroke-[1.5]" />
                    <span className="text-[9px] font-bold uppercase mt-1">Pas Foto 3x4</span>
                  </div>
                )}
              </div>

              {photoPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md hover:bg-rose-500 transition active:scale-95"
                  title="Hapus Foto"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Keterangan & Tombol Upload */}
            <div className="space-y-2 text-center sm:text-left flex-1">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Pas Foto Santri
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Gunakan foto formal portrait (maksimal 2MB, format JPG/PNG). Foto ini otomatis ditampilkan pada KTS Digital dan tabel master.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-cyan-500/50 hover:text-cyan-500 transition active:scale-95 shadow-sm"
                >
                  <Camera className="h-3.5 w-3.5 text-cyan-500" />
                  <span>{photoPreview ? "Ganti Foto" : "Unggah Pas Foto"}</span>
                </button>

                {photoFile && (
                  <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 truncate max-w-[200px]">
                    {photoFile.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Nama Lengkap */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nama Lengkap Santri <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Contoh: Muhammad Raihan Pratama"
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                required
              />
            </div>

            {/* NIS */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nomor Induk Santri (NIS) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="nis"
                value={formData.nis}
                onChange={handleChange}
                placeholder="Contoh: 20260012"
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3.5 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                required
              />
            </div>

            {/* Jenis Kelamin */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Jenis Kelamin (Gender) <span className="text-rose-500">*</span>
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none transition focus:border-cyan-500 cursor-pointer"
              >
                <option value="Laki-laki">Banin (Laki-laki / Putra)</option>
                <option value="Perempuan">Banat (Perempuan / Putri)</option>
              </select>
            </div>

            {/* NISN */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                NISN (Nomor Induk Siswa Nasional)
              </label>
              <input
                type="text"
                name="nisn"
                value={formData.nisn}
                onChange={handleChange}
                placeholder="Nomor Induk Siswa Nasional"
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3.5 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Tempat Lahir */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tempat Lahir
              </label>
              <input
                type="text"
                name="pob"
                value={formData.pob}
                onChange={handleChange}
                placeholder="Kota/Kabupaten Lahir"
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Tanggal Lahir */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tanggal Lahir
              </label>
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3.5 text-xs font-medium text-slate-900 dark:text-white outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Asal Konsulat */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Asal Konsulat / Organisasi Daerah
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="consulate"
                  value={formData.consulate}
                  onChange={handleChange}
                  placeholder="Contoh: Konsulat Tasikmalaya"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 pl-9 pr-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* BAGIAN 2: ROMBEL, PENEMPATAN ASRAMA & STATUS */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-500 font-bold text-xs">
              <School className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                2. ROMBEL, PENEMPATAN ASRAMA & STATUS
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pengelompokan kelas akademik dan kamar asrama santri
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Kelas */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Kelas <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="class"
                value={formData.class}
                onChange={handleChange}
                placeholder="Contoh: 1 KMI, 5B"
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3.5 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                required
              />
            </div>

            {/* Kamar Asrama */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Kamar Asrama
              </label>
              <input
                type="text"
                name="dorm"
                value={formData.dorm}
                onChange={handleChange}
                placeholder="Contoh: Kifayah 102"
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Tahun Masuk */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tahun Masuk
              </label>
              <input
                type="text"
                name="entry_year"
                value={formData.entry_year}
                onChange={handleChange}
                placeholder="2026"
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3.5 text-xs font-mono font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Status Santri */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Status Santri
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none transition focus:border-cyan-500 cursor-pointer"
              >
                <option value="active">Aktif Mukim</option>
                <option value="inactive">Non-Aktif / Pindah</option>
              </select>
            </div>
          </div>
        </div>

        {/* BAGIAN 3: DATA WALI & KONTAK KELUARGA */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 font-bold text-xs">
              <Home className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                3. DATA WALI & KONTAK KELUARGA
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Informasi orang tua/wali untuk integrasi notifikasi perizinan
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nama Lengkap Wali */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nama Lengkap Wali
              </label>
              <input
                type="text"
                name="guardian_name"
                value={formData.guardian_name}
                onChange={handleChange}
                placeholder="Nama Ayah / Ibu / Wali"
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* No. WhatsApp / Telepon */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                No. WhatsApp / Telepon
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="guardian_phone"
                  value={formData.guardian_phone}
                  onChange={handleChange}
                  placeholder="Contoh: 081234567890"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 pl-9 pr-3.5 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Alamat Lengkap */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Alamat Lengkap
              </label>
              <textarea
                name="address"
                rows={3}
                value={formData.address}
                onChange={handleChange}
                placeholder="Kampung/Jalan, RT/RW, Desa/Kelurahan, Kecamatan, Kota/Kabupaten, Provinsi"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Tombol Aksi Bawah */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/dashboard/students"
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 shadow-sm"
          >
            Batal
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Menyimpan Perubahan...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 stroke-[2.5]" />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}