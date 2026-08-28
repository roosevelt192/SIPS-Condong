"use client";

// =============================================================================
// 1. IMPORT DEPENDENCIES & ICONS
// =============================================================================
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  ArrowLeft,
  Search,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  User,
  Send,
  Scale,
  Flame,
  Zap,
  Layers,
  FileWarning,
  Activity,
  XCircle,
  IdCard,
  UploadCloud,
  FileText,
  FileCheck,
  Trash2,
  Paperclip,
  Plus,
  Award,
  Check,
  Users2,
  X,
  UserCheck,
  Calendar,
  Clock,
  MapPin,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// =============================================================================
// 2. INTERFACE DATA TYPES
// =============================================================================
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

interface AttachedDoc {
  file: File;
  id: string;
  previewUrl?: string;
}

// =============================================================================
// 3. PRESET STANDAR PELANGGARAN PONDOK
// =============================================================================
const PRESET_VIOLATIONS = [
  {
    name: "Terlambat Shalat Berjamaah / Disiplin Ibadah",
    category: "Ringan" as const,
    points: 5,
    tag: "Ibadah",
    icon: Activity,
    activeBorder: "border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 ring-2 ring-cyan-500/30",
    defaultSanction: "Takzir tilawah Al-Qur'an 1 juz & muadzin maghrib",
    defaultLocation: "Masjid Jami' Pesantren",
  },
  {
    name: "Pakaian / Atribut Tidak Sesuai Ketentuan Pondok",
    category: "Ringan" as const,
    points: 5,
    tag: "Kerapihan",
    icon: Layers,
    activeBorder: "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/30",
    defaultSanction: "Teguran lisan & penertiban atribut busana santri",
    defaultLocation: "Area Gedung Sekolah / Kelas",
  },
  {
    name: "Keluar Komplek Tanpa Surat Izin (Kabur Dekat)",
    category: "Sedang" as const,
    points: 20,
    tag: "Perizinan",
    icon: Zap,
    activeBorder: "border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/30",
    defaultSanction: "Takzir kebersihan asrama 3 hari & surat pembinaan",
    defaultLocation: "Luar Gerbang Komplek Pondok",
  },
  {
    name: "Membawa / Menyimpan HP atau Elektronik Terlarang",
    category: "Sedang" as const,
    points: 25,
    tag: "Ketertiban",
    icon: Flame,
    activeBorder: "border-orange-500 bg-orange-500/10 text-orange-800 dark:text-orange-300 ring-2 ring-orange-500/30",
    defaultSanction: "Penyitaan barang terlarang & pemanggilan pembina asrama",
    defaultLocation: "Kamar / Asrama Santri",
  },
  {
    name: "Perkelahian / Intimidasi Fisik Antar Santri",
    category: "Berat" as const,
    points: 50,
    tag: "Keamanan",
    icon: FileWarning,
    activeBorder: "border-rose-500 bg-rose-500/10 text-rose-800 dark:text-rose-300 ring-2 ring-rose-500/30",
    defaultSanction: "Surat Peringatan 1 (SP-1) & panggilan wali santri",
    defaultLocation: "Area Asrama / Lapangan",
  },
  {
    name: "Kabur Meninggalkan Pondok > 24 Jam Tanpa Izin",
    category: "Berat" as const,
    points: 75,
    tag: "Pelanggaran Berat",
    icon: ShieldAlert,
    activeBorder: "border-red-600 bg-red-600/10 text-red-800 dark:text-red-300 ring-2 ring-red-600/30",
    defaultSanction: "Surat Peringatan Keras (SP-2) & skorsing masa pembinaan",
    defaultLocation: "Luar Pondok / Rumah",
  },
];

export default function CreateViolationPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Database State
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [searchStudent, setSearchStudent] = useState("");

  // MULTI-SANTRI STATE
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [previewStudentIndex, setPreviewStudentIndex] = useState<number>(0);

  // Form Detail Pelanggaran
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentTimeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");

  const [violationName, setViolationName] = useState("");
  const [category, setCategory] = useState<"Ringan" | "Sedang" | "Berat">("Ringan");
  const [points, setPoints] = useState<number>(5);
  const [incidentDate, setIncidentDate] = useState(todayStr);
  const [incidentTime, setIncidentTime] = useState(currentTimeStr);
  const [location, setLocation] = useState("Kamar / Asrama Santri");
  const [customLocation, setCustomLocation] = useState("");
  const [sanction, setSanction] = useState("");
  const [status, setStatus] = useState<"Proses" | "Ditindak" | "Selesai">("Proses");
  const [description, setDescription] = useState("");

  // Multi-Upload State
  const [attachedFiles, setAttachedFiles] = useState<AttachedDoc[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // ===========================================================================
  // 4. NORMALISASI & FETCH DATA SANTRI
  // ===========================================================================
  const mapStudentData = (s: any): Student => ({
    id: String(s.id),
    nis: s.nis || "-",
    nisn: s.nisn || "-",
    name: s.full_name || s.name || s.nama || s.nama_lengkap || s.nama_santri || "Santri",
    gender: s.gender || s.jenis_kelamin || "-",
    pob: s.tempat_lahir || s.pob || "-",
    dob: s.tanggal_lahir || s.dob || "-",
    class: s.kelas || s.class_name || s.class || s.rombel || "-",
    dorm: s.kamar_asrama || s.dorm || s.room || s.asrama || "-",
    entry_year: String(s.tahun_masuk || s.entry_year || "2026"),
    consulate: s.asal_konsulat || s.consulate || s.origin_region || "-",
    guardian_name: s.nama_lengkap_wali || s.guardian_name || s.nama_wali || "-",
    guardian_phone: s.no_whatsapp || s.guardian_phone || s.phone || "-",
    address: s.alamat_lengkap || s.address || "-",
    photo_url: s.photo_url || s.foto || null,
    status: s.status_santri || s.status || "Aktif",
    points: Number(s.poin_disiplin ?? s.points ?? 100),
  });

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .range(0, 4999);

      if (error) throw error;
      if (data) {
        const mapped = data.map(mapStudentData);
        mapped.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(mapped);
      }
    } catch (err: any) {
      console.error("Gagal sinkron data santri:", err.message);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const filteredStudents =
    searchStudent.trim() === ""
      ? []
      : students.filter(
          (s) =>
            s.name?.toLowerCase().includes(searchStudent.toLowerCase()) ||
            s.nis?.toLowerCase().includes(searchStudent.toLowerCase()) ||
            s.class?.toLowerCase().includes(searchStudent.toLowerCase())
        );

  // ===========================================================================
  // 5. HANDLER MULTI-SANTRI
  // ===========================================================================
  const handleAddStudent = (st: Student) => {
    if (selectedStudents.some((s) => s.id === st.id || s.nis === st.nis)) {
      setErrorMessage(`Santri ${st.name} (NIS: ${st.nis}) sudah ada dalam daftar.`);
      return;
    }
    setSelectedStudents((prev) => [...prev, st]);
    setPreviewStudentIndex(selectedStudents.length);
    setSearchStudent("");
    setErrorMessage("");
  };

  const handleRemoveStudent = (id: string) => {
    const nextList = selectedStudents.filter((s) => s.id !== id);
    setSelectedStudents(nextList);
    if (previewStudentIndex >= nextList.length) {
      setPreviewStudentIndex(Math.max(0, nextList.length - 1));
    }
  };

  const handleClearAllStudents = () => {
    setSelectedStudents([]);
    setPreviewStudentIndex(0);
  };

  const applyPreset = (preset: typeof PRESET_VIOLATIONS[0]) => {
    setViolationName(preset.name);
    setCategory(preset.category);
    setPoints(preset.points);
    setSanction(preset.defaultSanction);
    if (preset.defaultLocation) {
      setLocation(preset.defaultLocation);
    }
  };

  // ===========================================================================
  // 6. MULTI-UPLOAD BERKAS DOKUMEN
  // ===========================================================================
  const addFilesToList = (files: FileList | File[]) => {
    const newDocs: AttachedDoc[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        alert(`Berkas ${file.name} melebihi 10MB.`);
        continue;
      }
      newDocs.push({
        file,
        id: `${file.name}-${Date.now()}-${i}`,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      });
    }
    setAttachedFiles((prev) => [...prev, ...newDocs]);
  };

  const handleMultipleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFilesToList(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeDoc = (id: string) => {
    setAttachedFiles((prev) => prev.filter((d) => d.id !== id));
  };

  // ===========================================================================
  // 7. SUBMIT BATCH PELANGGARAN KE DATABASE
  // ===========================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudents.length === 0) {
      setErrorMessage("Silakan pilih minimal 1 santri yang terlibat pelanggaran.");
      return;
    }
    if (!violationName.trim()) {
      setErrorMessage("Judul / bentuk pelanggaran wajib diisi.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      let firstDocUrl: string | null = null;

      if (attachedFiles.length > 0) {
        setUploadingFiles(true);
        for (const doc of attachedFiles) {
          const cleanName = doc.file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          const filePath = `documents/batch_${Date.now()}_${cleanName}`;

          const { error: uploadError } = await supabase.storage
            .from("violation-documents")
            .upload(filePath, doc.file, {
              cacheControl: "3600",
              upsert: true,
            });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from("violation-documents")
              .getPublicUrl(filePath);

            if (publicUrlData?.publicUrl && !firstDocUrl) {
              firstDocUrl = publicUrlData.publicUrl;
            }
          }
        }
      }

      // Waktu dan Lokasi Kejadian Terpadu
      const incidentTimestamp = new Date(`${incidentDate}T${incidentTime}:00`).toISOString();
      const finalLocation = location === "Lainnya" ? (customLocation || "Lingkungan Pondok") : location;

      const payloads = selectedStudents.map((st) => ({
        student_id: st.id,
        student_name: st.name,
        nis: st.nis,
        category,
        violation_name: violationName.trim(),
        points: Number(points),
        description: description.trim(),
        sanction: sanction.trim(),
        status,
        recorded_by: "Bagian Pengasuhan Santri",
        document_url: firstDocUrl,
        created_at: incidentTimestamp,
      }));

      const { error: insertErr } = await supabase.from("violations").insert(payloads);
      if (insertErr) throw insertErr;

      for (const st of selectedStudents) {
        const newPoints = Math.max(0, st.points - Number(points));
        await supabase
          .from("students")
          .update({ poin_disiplin: newPoints, points: newPoints })
          .eq("id", st.id);
      }

      router.push("/dashboard/violations");
      router.refresh();
    } catch (err: any) {
      setErrorMessage("Gagal menyimpan data pelanggaran: " + err.message);
      setSubmitting(false);
      setUploadingFiles(false);
    }
  };

  const currentPreviewStudent = selectedStudents[previewStudentIndex] || selectedStudents[0];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 font-sans relative">
      {/* ATMOSPHERIC DYNAMIC GLOW */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className={`absolute top-1/4 right-10 h-[550px] w-[550px] rounded-full blur-[160px] transition-all duration-700 ${
            points >= 50
              ? "bg-rose-600/20 scale-110"
              : points >= 20
              ? "bg-amber-500/15"
              : "bg-cyan-500/15"
          }`}
        />
        <div className="absolute bottom-10 left-10 h-[450px] w-[450px] rounded-full bg-indigo-500/10 blur-[150px]" />
      </div>

      {/* HEADER HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-5 sm:p-6 shadow-sm backdrop-blur-xl transition-all">
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-center space-x-3.5 min-w-0">
            <Link
              href="/dashboard/violations"
              className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-rose-500 hover:border-rose-500/40 hover:bg-rose-500/10 transition active:scale-95 shadow-xs"
              title="Kembali ke Daftar Pelanggaran"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
            </Link>

            <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500/20 via-orange-500/20 to-amber-500/20 text-rose-500 border border-rose-500/30 shadow-inner">
              <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 stroke-[2.3]" />
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-rose-500 border-2 border-white dark:border-slate-900 animate-ping" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                  Pencatatan Disiplin &amp; Pelanggaran
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-xs whitespace-nowrap">
                  <Sparkles className="h-3 w-3" /> Biro Tarbiyah
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Pencatatan santri perorangan maupun rombongan dalam satu kejadian
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end xl:self-center">
            <Link
              href="/dashboard/violations"
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 whitespace-nowrap"
            >
              Batalkan
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || selectedStudents.length === 0}
              className="group relative inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30 hover:scale-[1.02] active:scale-95 transition-all duration-200 disabled:opacity-40 overflow-hidden cursor-pointer whitespace-nowrap"
            >
              <Send className="h-3.5 w-3.5 stroke-[2.5] relative z-10 transition-transform duration-300 group-hover:translate-x-0.5" />
              <span className="relative z-10 whitespace-nowrap">
                {submitting
                  ? uploadingFiles
                    ? "Mengunggah..."
                    : "Menyimpan..."
                  : `Simpan Catatan (${selectedStudents.length} Santri)`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ERROR FEEDBACK BANNER */}
      {errorMessage && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/70 p-4 text-xs font-bold text-rose-200 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200 shadow-xl backdrop-blur-xl">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 animate-bounce" />
          <span className="flex-1">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage("")}
            className="text-rose-400 hover:text-white transition-colors"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* WORKSPACE 2-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= KOLOM KIRI: MULTI-SANTRI & KARTU KTS ================= */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-[32px] border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center font-black">
                  1
                </div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Santri yang Terlibat ({selectedStudents.length})
                </h2>
              </div>
              <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                {students.length} Santri Terdaftar
              </span>
            </div>

            {/* Input Pencarian */}
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Ketik nama / NIS untuk menambah santri..."
                className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-11 pr-10 text-xs font-semibold outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15 transition-all"
              />
              {searchStudent && (
                <button
                  type="button"
                  onClick={() => setSearchStudent("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Hasil Rekomendasi Pencarian */}
            {searchStudent.trim() !== "" && (
              <div className="space-y-1.5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/80 p-2 border border-slate-200 dark:border-slate-800 max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in duration-150">
                {filteredStudents.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-5 font-medium">
                    Santri dengan kata kunci &ldquo;{searchStudent}&rdquo; tidak ditemukan.
                  </p>
                ) : (
                  filteredStudents.map((st) => (
                    <div
                      key={st.id}
                      onClick={() => handleAddStudent(st)}
                      className="p-3 rounded-xl cursor-pointer flex items-center justify-between hover:bg-rose-500 hover:text-white group transition-all duration-150 text-slate-700 dark:text-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <div className="h-9 w-9 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-white/20 group-hover:text-white overflow-hidden relative border border-slate-300/40 dark:border-slate-700">
                          {st.photo_url ? (
                            <img
                              src={st.photo_url}
                              alt={st.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            st.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-black leading-tight truncate group-hover:text-white">
                            {st.name}
                          </p>
                          <p className="text-[10px] mt-0.5 text-slate-400 group-hover:text-rose-100 font-medium">
                            NIS: {st.nis} • Kelas: {st.class || "-"} • Asrama: {st.dorm || "-"}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-white tracking-wider ml-2 shrink-0 flex items-center gap-1">
                        + Tambah
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* DAFTAR CHIP SANTRI YANG TERPILIH */}
            {selectedStudents.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
                  <span>Daftar Santri Terpilih ({selectedStudents.length}):</span>
                  <button
                    type="button"
                    onClick={handleClearAllStudents}
                    className="text-rose-500 hover:underline text-[10px] font-bold"
                  >
                    Hapus Semua
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto custom-scrollbar p-1">
                  {selectedStudents.map((st, idx) => {
                    const isPreviewed = previewStudentIndex === idx;
                    return (
                      <div
                        key={st.id}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isPreviewed
                            ? "bg-rose-500 text-white shadow-md shadow-rose-500/20 ring-2 ring-rose-500/40"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        <span
                          onClick={() => setPreviewStudentIndex(idx)}
                          className="cursor-pointer"
                        >
                          {st.name} ({st.nis})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(st.id)}
                          className="text-slate-400 hover:text-white transition ml-1"
                          title="Hapus santri dari daftar ini"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ================= KARTU IDENTITAS DIGITAL (KTS RESMI) ================= */}
          {currentPreviewStudent ? (
            <div className="relative overflow-hidden rounded-[28px] border-2 border-cyan-500/40 bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95 group hover:border-cyan-500/70">
              <div className="relative bg-gradient-to-r from-blue-600 via-cyan-500 to-sky-600 px-6 py-4 text-white overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-white/10 skew-x-12 pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <h3 className="text-sm font-black tracking-widest uppercase shadow-sm flex items-center gap-1.5">
                      <IdCard className="h-4 w-4" /> KARTU TANDA SANTRI (KTS)
                    </h3>
                    <p className="text-[10px] font-bold text-cyan-100 tracking-wider mt-0.5">
                      TAHUN MASUK: {currentPreviewStudent.entry_year || "2026"}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase border border-white/20 shadow-sm">
                    Pratinjau #{previewStudentIndex + 1}
                  </span>
                </div>
              </div>

              <div className="p-6 bg-slate-50/50 dark:bg-slate-900/60 relative">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
                  <div className="relative h-[180px] w-[135px] shrink-0 rounded-2xl overflow-hidden border-[5px] border-white dark:border-slate-800 bg-gradient-to-tr from-cyan-600 to-blue-500 shadow-xl transition-all duration-300 group-hover:scale-105 flex items-center justify-center">
                    {currentPreviewStudent.photo_url ? (
                      <img
                        src={currentPreviewStudent.photo_url}
                        alt={currentPreviewStudent.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-white bg-slate-800">
                        <User className="h-16 w-16 stroke-[1.2]" />
                        <span className="text-[10px] font-bold mt-2 uppercase text-slate-400">No Photo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-3 text-xs text-slate-800 dark:text-slate-200">
                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-4 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px]">
                        Nomor (NIS)
                      </span>
                      <span className="col-span-1 text-center font-bold text-slate-400">:</span>
                      <span className="col-span-7 font-mono font-black text-cyan-600 dark:text-cyan-400 text-sm leading-none">
                        {currentPreviewStudent.nis || "-"}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-4 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px]">
                        Nama Lengkap
                      </span>
                      <span className="col-span-1 text-center font-bold text-slate-400">:</span>
                      <span className="col-span-7 font-black text-slate-900 dark:text-white uppercase leading-tight">
                        {currentPreviewStudent.name}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-4 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px]">
                        Kelas / Jenjang
                      </span>
                      <span className="col-span-1 text-center font-bold text-slate-400">:</span>
                      <span className="col-span-7 font-extrabold text-slate-800 dark:text-slate-200">
                        {currentPreviewStudent.class || "-"}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-4 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px]">
                        Kamar / Asrama
                      </span>
                      <span className="col-span-1 text-center font-bold text-slate-400">:</span>
                      <span className="col-span-7 font-extrabold text-slate-800 dark:text-slate-200">
                        {currentPreviewStudent.dorm || "-"}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-4 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px]">
                        Konsulat / Asal
                      </span>
                      <span className="col-span-1 text-center font-bold text-slate-400">:</span>
                      <span className="col-span-7 font-bold text-slate-700 dark:text-slate-300 line-clamp-2">
                        {currentPreviewStudent.consulate || "-"}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-4 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px]">
                        Kontak Wali
                      </span>
                      <span className="col-span-1 text-center font-bold text-slate-400">:</span>
                      <span className="col-span-7 font-mono font-medium text-slate-600 dark:text-slate-400">
                        {currentPreviewStudent.guardian_phone || "-"}
                        {currentPreviewStudent.guardian_name && currentPreviewStudent.guardian_name !== "-" ? ` (${currentPreviewStudent.guardian_name})` : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-100 dark:bg-slate-950 px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="font-extrabold text-cyan-600 dark:text-cyan-400 tracking-wider flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5" /> SIPS PESANTREN
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Status: {currentPreviewStudent.status || "Aktif Mukim"}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-10 text-center text-slate-400 space-y-3">
              <div className="h-16 w-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 shadow-inner">
                <IdCard className="h-8 w-8 stroke-[1.5]" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                  Belum Ada Santri yang Dipilih
                </p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                  Ketik nama atau NIS santri pada kolom pencarian di atas untuk menambahkan santri yang terlibat.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ================= KOLOM KANAN: DETAIL PELANGGARAN & WAKTU / LOKASI ================= */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-[32px] border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-black">
                  2
                </div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Detail Pelanggaran &amp; Kronologi
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-sm ${
                    points >= 50
                      ? "bg-rose-500 text-white shadow-rose-500/30 animate-pulse scale-105"
                      : points >= 20
                      ? "bg-amber-500 text-slate-950 shadow-amber-500/20"
                      : "bg-cyan-500 text-slate-950 shadow-cyan-500/20"
                  }`}
                >
                  +{points} Poin Disiplin
                </span>
              </div>
            </div>

            {/* PRESET STANDAR PONDOK */}
            <div className="space-y-2.5">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Preset Standar Pondok
                </span>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">Klik opsi untuk mengisi cepat</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_VIOLATIONS.map((p, idx) => {
                  const Icon = p.icon;
                  const isActive = violationName === p.name;
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
                          <Icon className={`h-4 w-4 ${isActive ? "text-rose-500" : "text-slate-400"}`} />
                          <span className={`text-[10px] font-black uppercase tracking-wider ${isActive ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>
                            {p.tag}
                          </span>
                        </div>
                        <span className="text-xs font-black text-rose-500">+{p.points} Poin</span>
                      </div>
                      <p className="text-xs font-bold mt-2 leading-snug">
                        {p.name}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FORM INPUT FIELDS */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Judul / Bentuk Pelanggaran *
                </label>
                <input
                  type="text"
                  required
                  value={violationName}
                  onChange={(e) => setViolationName(e.target.value)}
                  placeholder="Contoh: Terlambat Shalat Berjamaah Subuh"
                  className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15 transition-all"
                />
              </div>

              {/* Kategori, Poin, & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Kategori Tingkat
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 transition-all cursor-pointer"
                  >
                    <option value="Ringan">Ringan (5 - 15)</option>
                    <option value="Sedang">Sedang (20 - 40)</option>
                    <option value="Berat">Berat (≥ 50 Poin)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Beban Poin (+)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                    className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-xs font-black text-rose-500 outline-none focus:border-rose-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Status Tindakan
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 transition-all cursor-pointer"
                  >
                    <option value="Proses">Dalam Proses</option>
                    <option value="Ditindak">Sudah Ditindak</option>
                    <option value="Selesai">Selesai Dibina</option>
                  </select>
                </div>
              </div>

              {/* BARU: WAKTU & LOKASI KEJADIAN */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4 space-y-3">
                <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
                  <Calendar className="h-4 w-4" />
                  <span>Waktu &amp; Tempat Kejadian Perkara (TKP)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Tanggal Kejadian */}
                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Tanggal Kejadian</label>
                    <input
                      type="date"
                      value={incidentDate}
                      onChange={(e) => setIncidentDate(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                    />
                  </div>

                  {/* Jam Kejadian */}
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Pukul / Jam</label>
                    <input
                      type="time"
                      value={incidentTime}
                      onChange={(e) => setIncidentTime(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                    />
                  </div>

                  {/* Lokasi / TKP */}
                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Lokasi / Tempat Kejadian</label>
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 cursor-pointer"
                    >
                      <option value="Kamar / Asrama Santri">Kamar / Asrama Santri</option>
                      <option value="Masjid Jami' Pesantren">Masjid Jami' Pesantren</option>
                      <option value="Area Gedung Sekolah / Kelas">Area Gedung Sekolah / Kelas</option>
                      <option value="Area Kantin / Koperasi">Area Kantin / Koperasi</option>
                      <option value="Lapangan Olahraga / Terbuka">Lapangan Olahraga / Terbuka</option>
                      <option value="Luar Gerbang Komplek Pondok">Luar Gerbang Komplek Pondok</option>
                      <option value="Lainnya">Lokasi Lainnya (Ketik Manual)...</option>
                    </select>
                  </div>
                </div>

                {location === "Lainnya" && (
                  <div className="pt-1">
                    <input
                      type="text"
                      value={customLocation}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      placeholder="Ketik detail nama tempat / lokasi kejadian..."
                      className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                    />
                  </div>
                )}
              </div>

              {/* Bentuk Sanksi */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Bentuk Sanksi / Tindak Lanjut Tarbiyah
                </label>
                <input
                  type="text"
                  value={sanction}
                  onChange={(e) => setSanction(e.target.value)}
                  placeholder="Contoh: Takzir kebersihan masjid / Hafalan kosakata / Pemanggilan Wali"
                  className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-rose-500 transition-all"
                />
              </div>

              {/* Kronologi */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Catatan Kronologi / Keterangan Kejadian
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan saksi, tempat kejadian, atau kronologi khusus pembina asrama..."
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-rose-500 custom-scrollbar transition-all"
                />
              </div>

              {/* MULTI-UPLOAD BERKAS BUKTI */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-rose-500" />
                    Lampiran Dokumen &amp; Bukti (PDF / Foto Kejadian)
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                    {attachedFiles.length} Berkas Terpilih
                  </span>
                </div>

                {attachedFiles.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in duration-200">
                    {attachedFiles.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <div className="h-9 w-9 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0 border border-cyan-500/20">
                            {item.file.type.includes("pdf") ? (
                              <FileText className="h-4 w-4" />
                            ) : (
                              <FileCheck className="h-4 w-4" />
                            )}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                              {item.file.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                              {(item.file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDoc(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0 ml-2 active:scale-90 cursor-pointer"
                          title="Hapus berkas ini"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files) {
                      addFilesToList(e.dataTransfer.files);
                    }
                  }}
                  className={`cursor-pointer border-2 border-dashed rounded-2xl p-5 text-center transition-all duration-200 group relative overflow-hidden active:scale-99 ${
                    isDragging
                      ? "border-rose-500 bg-rose-500/10 scale-[1.01]"
                      : "border-slate-200 dark:border-slate-800/80 hover:border-rose-500/60 dark:hover:border-rose-500/60 bg-slate-50/50 dark:bg-slate-950/50 hover:bg-rose-50/20 dark:hover:bg-rose-950/10"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={handleMultipleFiles}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                      <UploadCloud className="h-5 w-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {attachedFiles.length === 0
                          ? "Tarik & Lepas Dokumen / Foto Bukti di Sini"
                          : "Klik untuk Menambah Dokumen Lain"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Mendukung Banyak Berkas Sekaligus (PDF Surat Pernyataan / Foto Bukti Kejadian)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <Link
                href="/dashboard/violations"
                className="px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 whitespace-nowrap"
              >
                Batalkan
              </Link>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || selectedStudents.length === 0}
                className="group relative inline-flex items-center space-x-2.5 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 px-7 py-3 text-xs sm:text-sm font-black text-white shadow-xl shadow-rose-500/25 hover:shadow-rose-500/40 hover:scale-[1.02] active:scale-95 transition-all duration-200 disabled:opacity-40 overflow-hidden cursor-pointer whitespace-nowrap"
              >
                <Send className="h-4 w-4 stroke-[2.5] relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
                <span className="relative z-10 whitespace-nowrap">
                  {submitting
                    ? uploadingFiles
                      ? "Mengunggah Berkas..."
                      : "Menyimpan Data..."
                    : `Simpan Catatan (${selectedStudents.length} Santri)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}