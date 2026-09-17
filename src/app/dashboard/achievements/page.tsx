"use client";

// =============================================================================
// 1. IMPORT DEPENDENCIES & ICONS
// =============================================================================
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import ExcelJS from "exceljs";
import {
  Trophy,
  Plus,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Edit,
  Trash2,
  FileText,
  X,
  Calendar,
  CheckSquare,
  Square,
  Check,
  FileSpreadsheet,
  Printer,
  History,
  User,
  Phone,
  Home,
  MapPin,
  GraduationCap,
  Medal,
  Award,
  Globe2,
  Sparkles,
  ExternalLink,
  ArrowLeft,
  Star,
  Save,
  QrCode,
  Filter,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import QRScannerModal from "@/components/QRScannerModal";
import { parseQRCodeText } from "@/lib/qrParser";
import { playScanSound } from "@/lib/feedback";

// =============================================================================
// 2. INTERFACE DATA TYPES
// =============================================================================
interface AchievementRecord {
  id: string;
  student_id?: string;
  student_name: string;
  nis: string;
  title: string;
  category: string;
  level: string;
  reward_points: number;
  appreciation?: string;
  description?: string;
  certificate_url?: string;
  event_date: string;
  created_at: string;
}

interface StudentSummary {
  id: string;
  nis: string;
  name: string;
  class: string;
  dorm: string;
  consulate: string;
  guardian_name?: string;
  guardian_phone?: string;
  photo_url?: string | null;
  totalRewardPoints: number;
  achievementsCount: number;
}

interface RawStudent {
  id: string;
  nis: string;
  full_name?: string;
  name?: string;
  nama?: string;
  kelas?: string;
  class_name?: string;
  class?: string;
  kamar_asrama?: string;
  dorm?: string;
  room?: string;
  asrama?: string;
  asal_konsulat?: string;
  consulate?: string;
  origin_region?: string;
  nama_lengkap_wali?: string;
  guardian_name?: string;
  nama_wali?: string;
  no_whatsapp?: string;
  guardian_phone?: string;
  phone?: string;
  photo_url?: string | null;
  foto?: string | null;
}

export default function AchievementsPage() {
  // ===========================================================================
  // 3. STATE MANAGEMENT
  // ===========================================================================
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [rawStudents, setRawStudents] = useState<RawStudent[]>([]);
  const [studentsMap, setStudentsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Scanner State
  const [showScanner, setShowScanner] = useState(false);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterDorm, setFilterDorm] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState<"all" | "7days" | "30days" | "semester" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "points_high" | "points_low" | "name_asc">("newest");
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Single Delete State
  const [itemToDelete, setItemToDelete] = useState<AchievementRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Catat Prestasi Baru
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSearchStudent, setCreateSearchStudent] = useState("");
  const [selectedStudentForCreate, setSelectedStudentForCreate] = useState<RawStudent | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createCategory, setCreateCategory] = useState("Tahfidz / Al-Qur'an");
  const [createLevel, setCreateLevel] = useState("Kabupaten / Kota");
  const [createEventDate, setCreateEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [createRewardPoints, setCreateRewardPoints] = useState<number>(20);
  const [createAppreciation, setCreateAppreciation] = useState("Piagam Penghargaan");
  const [createDescription, setCreateDescription] = useState("");
  const [createCertificateUrl, setCreateCertificateUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<AchievementRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("Tahfidz / Al-Qur'an");
  const [editLevel, setEditLevel] = useState("Kabupaten / Kota");
  const [editEventDate, setEditEventDate] = useState("");
  const [editRewardPoints, setEditRewardPoints] = useState<number>(20);
  const [editAppreciation, setEditAppreciation] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  // Batch Delete State
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Dossier Modal
  const [selectedStudentForDossier, setSelectedStudentForDossier] = useState<StudentSummary | null>(null);
  const [dossierPeriodFilter, setDossierPeriodFilter] = useState<"all" | "7days" | "30days" | "semester">("all");

  // ===========================================================================
  // 4. FETCH DATA (BATCH PAGINATION)
  // ===========================================================================
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      let allStudents: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase.from("students").select("*").range(from, to);
        if (error) throw error;
        if (data && data.length > 0) {
          allStudents = [...allStudents, ...data];
          if (data.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }

      setRawStudents(allStudents);

      const stLookup: Record<string, any> = {};
      allStudents.forEach((st: any) => {
        const nisKey = String(st.nis || "").trim();
        stLookup[nisKey] = {
          id: String(st.id),
          name: (st.full_name || st.name || st.nama || "Santri").trim(),
          class: (st.class || st.kelas || st.class_name || st.rombel || "-").trim(),
          dorm: (st.dorm || st.kamar_asrama || st.asrama || st.room || "-").trim(),
          consulate: (st.consulate || st.asal_konsulat || st.origin_region || "-").trim(),
          guardian_name: st.guardian_name || st.nama_lengkap_wali || "-",
          phone: st.guardian_phone || st.no_whatsapp || "-",
          photo_url: st.photo_url || st.foto || null,
        };
      });
      setStudentsMap(stLookup);

      const { data: achData, error } = await supabase
        .from("achievements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAchievements(achData || []);
      setSelectedIds([]);
    } catch (err: any) {
      console.warn("Gagal memuat catatan prestasi:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================================
  // 5. SCANNER QR CODE HANDLER
  // ===========================================================================
  const handleScanSuccess = async (rawDecodedText: string) => {
    setShowScanner(false);
    const { searchKey, nis, id } = parseQRCodeText(rawDecodedText);
    const targetKey = (nis || searchKey).trim();

    let studentMeta = studentsMap[targetKey];

    if (!studentMeta && targetKey) {
      const { data: st } = await supabase
        .from("students")
        .select("*")
        .or(`nis.eq.${targetKey},id.eq.${id || targetKey}`)
        .maybeSingle();

      if (st) {
        studentMeta = {
          id: String(st.id),
          name: st.full_name || st.name || "Santri",
          class: st.class || st.kelas || "-",
          dorm: st.dorm || st.kamar_asrama || "-",
          consulate: st.consulate || "-",
          guardian_name: st.guardian_name || "-",
          phone: st.guardian_phone || "-",
          photo_url: st.photo_url || null,
        };
      }
    }

    if (studentMeta) {
      playScanSound("success");
      const allStudentAchievements = achievements.filter(
        (item) => item.nis === targetKey || item.student_id === studentMeta.id
      );
      const totalPts = allStudentAchievements.reduce(
        (acc, curr) => acc + (Number(curr.reward_points) || 0),
        0
      );

      setSelectedStudentForDossier({
        id: studentMeta.id,
        nis: targetKey,
        name: studentMeta.name,
        class: studentMeta.class,
        dorm: studentMeta.dorm,
        consulate: studentMeta.consulate,
        guardian_name: studentMeta.guardian_name,
        guardian_phone: studentMeta.phone,
        photo_url: studentMeta.photo_url,
        totalRewardPoints: totalPts,
        achievementsCount: allStudentAchievements.length,
      });
      setDossierPeriodFilter("all");
    } else {
      playScanSound("error");
      setSearchQuery(targetKey);
    }
  };

  const handleLevelPointCalculation = (lvl: string, isEdit = false) => {
    let pts = 20;
    if (lvl === "Internal Pondok") pts = 10;
    else if (lvl === "Kabupaten / Kota") pts = 20;
    else if (lvl === "Provinsi") pts = 35;
    else if (lvl === "Nasional") pts = 50;
    else if (lvl === "Internasional") pts = 100;

    if (isEdit) {
      setEditLevel(lvl);
      setEditRewardPoints(pts);
    } else {
      setCreateLevel(lvl);
      setCreateRewardPoints(pts);
    }
  };

  // Opsi Dropdown Kelas & Kamar
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    Object.values(studentsMap).forEach((st) => {
      if (st.class && st.class !== "-") set.add(st.class);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [studentsMap]);

  const availableDorms = useMemo(() => {
    const set = new Set<string>();
    Object.values(studentsMap).forEach((st) => {
      if (st.dorm && st.dorm !== "-") set.add(st.dorm);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [studentsMap]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterCategory !== "all") count++;
    if (filterLevel !== "all") count++;
    if (filterClass !== "all") count++;
    if (filterDorm !== "all") count++;
    if (filterPeriod !== "all") count++;
    return count;
  }, [filterCategory, filterLevel, filterClass, filterDorm, filterPeriod]);

  const resetAllFilters = () => {
    setFilterCategory("all");
    setFilterLevel("all");
    setFilterClass("all");
    setFilterDorm("all");
    setFilterPeriod("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setSearchQuery("");
  };

  // ===========================================================================
  // 6. FILTERING & SORTING LOGIC
  // ===========================================================================
  const filteredAchievements = useMemo(() => {
    const now = new Date();

    return achievements
      .filter((a) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          q === "" ||
          a.student_name.toLowerCase().includes(q) ||
          a.nis.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q);

        const matchesCategory = filterCategory === "all" || a.category === filterCategory;
        const matchesLevel = filterLevel === "all" || a.level === filterLevel;

        const meta = studentsMap[a.nis] || {};
        const matchesClass = filterClass === "all" || meta.class === filterClass;
        const matchesDorm = filterDorm === "all" || meta.dorm === filterDorm;

        let matchesPeriod = true;
        const targetDate = new Date(a.event_date || a.created_at);

        if (filterPeriod === "7days") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          matchesPeriod = targetDate >= sevenDaysAgo;
        } else if (filterPeriod === "30days") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          matchesPeriod = targetDate >= thirtyDaysAgo;
        } else if (filterPeriod === "semester") {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(now.getMonth() - 6);
          matchesPeriod = targetDate >= sixMonthsAgo;
        } else if (filterPeriod === "custom") {
          if (customStartDate) {
            matchesPeriod = matchesPeriod && targetDate >= new Date(`${customStartDate}T00:00:00`);
          }
          if (customEndDate) {
            matchesPeriod = matchesPeriod && targetDate <= new Date(`${customEndDate}T23:59:59`);
          }
        }

        return matchesSearch && matchesCategory && matchesLevel && matchesClass && matchesDorm && matchesPeriod;
      })
      .sort((a, b) => {
        if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortBy === "points_high") return Number(b.reward_points) - Number(a.reward_points);
        if (sortBy === "points_low") return Number(a.reward_points) - Number(b.reward_points);
        if (sortBy === "name_asc") return a.student_name.localeCompare(b.student_name);
        return 0;
      });
  }, [achievements, searchQuery, filterCategory, filterLevel, filterClass, filterDorm, filterPeriod, customStartDate, customEndDate, sortBy, studentsMap]);

  const stats = useMemo(() => {
    const totalAchievements = achievements.length;
    const totalPointsAwarded = achievements.reduce((acc, curr) => acc + (Number(curr.reward_points) || 0), 0);
    const nationalGlobalCount = achievements.filter((a) => a.level === "Nasional" || a.level === "Internasional").length;
    const tahfidzCount = achievements.filter((a) => a.category?.includes("Tahfidz") || a.category?.includes("Qur")).length;
    return { totalAchievements, totalPointsAwarded, nationalGlobalCount, tahfidzCount };
  }, [achievements]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredAchievements.length === 0) return false;
    return filteredAchievements.every((a) => selectedIds.includes(a.id));
  }, [filteredAchievements, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredAchievements.map((a) => a.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...filteredAchievements.map((v) => v.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // ===========================================================================
  // 7. CREATE ACTION
  // ===========================================================================
  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForCreate) {
      setCreateError("Silakan cari dan pilih santri yang bersangkutan.");
      return;
    }
    if (!createTitle.trim()) {
      setCreateError("Nama kejuaraan / capaian prestasi wajib diisi.");
      return;
    }

    setIsCreating(true);
    setCreateError("");
    try {
      const studentFullName = selectedStudentForCreate.full_name || selectedStudentForCreate.name || selectedStudentForCreate.nama || "Santri";
      const payload = {
        student_id: selectedStudentForCreate.id,
        student_name: studentFullName,
        nis: selectedStudentForCreate.nis,
        title: createTitle.trim(),
        category: createCategory,
        level: createLevel,
        event_date: createEventDate,
        reward_points: Number(createRewardPoints),
        appreciation: createAppreciation.trim() || "Piagam Penghargaan",
        description: createDescription.trim() || null,
        certificate_url: createCertificateUrl.trim() || null,
      };

      const { error } = await supabase.from("achievements").insert([payload]);
      if (error) throw error;

      setShowCreateModal(false);
      setSelectedStudentForCreate(null);
      setCreateTitle("");
      setCreateDescription("");
      setCreateCertificateUrl("");
      await fetchData();
    } catch (err: any) {
      setCreateError(err.message || "Gagal mencatat prestasi.");
    } finally {
      setIsCreating(false);
    }
  };

  // ===========================================================================
  // 8. EXPORT EXCEL PROFESIONAL (EXCELJS)
  // ===========================================================================
  const handleExportExcel = async () => {
    if (filteredAchievements.length === 0) {
      alert("Tidak ada data prestasi untuk diekspor.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SIPS Condong - Biro Prestasi";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Rekap_Prestasi", {
      views: [{ state: "frozen", ySplit: 4, xSplit: 3 }],
    });

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "CBD5E1" } },
      left: { style: "thin", color: { argb: "CBD5E1" } },
      bottom: { style: "thin", color: { argb: "CBD5E1" } },
      right: { style: "thin", color: { argb: "CBD5E1" } },
    };

    // Kop Resmi
    ws.mergeCells("A1:K1");
    const titleCell = ws.getCell("A1");
    titleCell.value = "PONDOK PESANTREN CONDONG - REKAPITULASI PRESTASI SANTRI";
    titleCell.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "064E3B" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 24;

    ws.mergeCells("A2:K2");
    const subCell = ws.getCell("A2");
    subCell.value = `Dicetak: ${new Date().toLocaleDateString("id-ID", { dateStyle: "full" })} • Total: ${filteredAchievements.length} Prestasi Tercatat`;
    subCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "064E3B" } };
    subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D1FAE5" } };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    // Header Kolom
    const headers = ["NO", "TANGGAL", "NIS", "NAMA SANTRI", "KELAS", "KAMAR", "KONSULAT", "KATEGORI", "NAMA KEJUARAAN / PRESTASI", "TINGKAT", "REWARD POIN"];
    const hRow = ws.getRow(4);
    hRow.values = headers;
    hRow.height = 24;
    hRow.eachCell((c) => {
      c.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "047857" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = borderStyle;
    });

    filteredAchievements.forEach((a, idx) => {
      const meta = studentsMap[a.nis] || {};
      const row = ws.getRow(idx + 5);
      row.values = [
        idx + 1,
        new Date(a.event_date || a.created_at).toLocaleDateString("id-ID"),
        a.nis,
        a.student_name,
        meta.class || "-",
        meta.dorm || "-",
        meta.consulate || "-",
        a.category,
        a.title,
        a.level,
        `+${a.reward_points}`,
      ];
      row.height = 19;
      const isEven = idx % 2 === 1;
      row.eachCell((cell, colNum) => {
        cell.font = { name: "Segoe UI", size: 9 };
        cell.border = borderStyle;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEven ? "F0FDF4" : "FFFFFF" } };
        cell.alignment = { horizontal: [1, 2, 5, 8, 10, 11].includes(colNum) ? "center" : "left", vertical: "middle" };
      });
    });

    ws.columns = [
      { width: 6 }, { width: 13 }, { width: 14 }, { width: 30 }, { width: 12 }, { width: 20 },
      { width: 20 }, { width: 20 }, { width: 36 }, { width: 16 }, { width: 14 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rekap_Prestasi_Santri_${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ===========================================================================
  // 9. CETAK LAPORAN PDF RESMI A4 (ISOLATED ENGINE)
  // ===========================================================================
  const handlePrintOfficialPDF = () => {
    if (filteredAchievements.length === 0) {
      alert("Tidak ada data untuk dicetak.");
      return;
    }

    const existingIframe = document.getElementById("sips-achievements-pdf-frame");
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "sips-achievements-pdf-frame";
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan_Prestasi_Santri_${new Date().toISOString().split("T")[0]}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 15mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, sans-serif; }
            body { color: #000; font-size: 8pt; }
            .kop { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
            .kop h2 { font-size: 11pt; font-weight: 900; text-transform: uppercase; }
            .kop p { font-size: 7.5pt; color: #333; margin-top: 1px; }
            .meta { width: 100%; border: 1px solid #999; padding: 5px 8px; margin-bottom: 10px; font-size: 7.5pt; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 7.5pt; }
            th, td { border: 1px solid #444; padding: 4px 5px; }
            th { background-color: #ecfdf5; font-weight: bold; text-align: center; }
            .ttd { display: flex; justify-content: space-between; margin-top: 25px; font-size: 8pt; text-align: center; }
            .ttd-col { width: 40%; }
            .ttd-space { height: 45px; }
          </style>
        </head>
        <body>
          <div class="kop">
            <h2>PONDOK PESANTREN CONDONG</h2>
            <p>BIRO PEMBINAAN & PENGHARGAAN PRESTASI SANTRI (SIPS)</p>
            <p style="font-size: 7pt; color: #666;">Jl. Condong No. 01, Setianagara, Cibeureum, Kota Tasikmalaya, Jawa Barat</p>
          </div>
          <div class="meta">
            <div>
              <p><b>Filter Kategori:</b> ${filterCategory.toUpperCase()}</p>
              <p><b>Filter Tingkat:</b> ${filterLevel.toUpperCase()}</p>
            </div>
            <div style="text-align: right;">
              <p><b>Total Prestasi:</b> ${filteredAchievements.length} Capaian</p>
              <p><b>Tanggal Dokumen:</b> ${new Date().toLocaleDateString("id-ID", { dateStyle: "full" })}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 25px;">No</th>
                <th style="width: 70px;">Tanggal</th>
                <th style="width: 70px;">NIS</th>
                <th>Nama Santri</th>
                <th style="width: 50px;">Kelas</th>
                <th>Nama Kejuaraan / Prestasi</th>
                <th style="width: 65px;">Tingkat</th>
                <th style="width: 40px;">Poin</th>
                <th>Bentuk Apresiasi</th>
              </tr>
            </thead>
            <tbody>
              ${filteredAchievements
                .map((a, i) => {
                  const meta = studentsMap[a.nis] || {};
                  return `
                    <tr>
                      <td align="center">${i + 1}</td>
                      <td align="center">${new Date(a.event_date || a.created_at).toLocaleDateString("id-ID")}</td>
                      <td align="center">${a.nis}</td>
                      <td><b>${a.student_name}</b></td>
                      <td align="center">${meta.class || "-"}</td>
                      <td>${a.title}</td>
                      <td align="center">${a.level}</td>
                      <td align="center" style="font-weight: bold; color: #047857;">+${a.reward_points}</td>
                      <td>${a.appreciation || "Piagam Penghargaan"}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
          <div class="ttd">
            <div class="ttd-col">
              <p>Mengetahui,</p>
              <p><b>Kepala Bagian Pengasuhan</b></p>
              <div class="ttd-space"></div>
              <p><u>( Ust. Pengasuhan Santri )</u></p>
            </div>
            <div class="ttd-col">
              <p>Tasikmalaya, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p><b>Pembina Prestasi Santri</b></p>
              <div class="ttd-space"></div>
              <p><u>( ............................................ )</u></p>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 400);
  };

  // ===========================================================================
  // 10. INDIVIDUAL DOSSIER & RAPOR PRESTASI
  // ===========================================================================
  const handleOpenStudentDossier = (a: AchievementRecord) => {
    const meta = studentsMap[a.nis] || {};
    const allStudentAchievements = achievements.filter((item) => item.nis === a.nis);
    const totalPts = allStudentAchievements.reduce((acc, curr) => acc + (Number(curr.reward_points) || 0), 0);

    setSelectedStudentForDossier({
      id: a.student_id || "",
      nis: a.nis,
      name: a.student_name,
      class: meta.class || "-",
      dorm: meta.dorm || "-",
      consulate: meta.consulate || "-",
      guardian_name: meta.guardian_name || "-",
      guardian_phone: meta.phone || "-",
      photo_url: meta.photo_url || null,
      totalRewardPoints: totalPts,
      achievementsCount: allStudentAchievements.length,
    });
    setDossierPeriodFilter("all");
  };

  const studentDossierAchievements = useMemo(() => {
    if (!selectedStudentForDossier) return [];
    const now = new Date();

    return achievements.filter((a) => {
      if (a.nis !== selectedStudentForDossier.nis) return false;
      const targetDate = new Date(a.event_date || a.created_at);

      if (dossierPeriodFilter === "7days") {
        const d = new Date();
        d.setDate(now.getDate() - 7);
        return targetDate >= d;
      }
      if (dossierPeriodFilter === "30days") {
        const d = new Date();
        d.setDate(now.getDate() - 30);
        return targetDate >= d;
      }
      if (dossierPeriodFilter === "semester") {
        const d = new Date();
        d.setMonth(now.getMonth() - 6);
        return targetDate >= d;
      }
      return true;
    });
  }, [achievements, selectedStudentForDossier, dossierPeriodFilter]);

  const dossierFilteredPoints = useMemo(() => {
    return studentDossierAchievements.reduce((acc, curr) => acc + (Number(curr.reward_points) || 0), 0);
  }, [studentDossierAchievements]);

  const handlePrintStudentDossier = () => {
    if (!selectedStudentForDossier) return;
    const existingIframe = document.getElementById("sips-ach-dossier-frame");
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "sips-ach-dossier-frame";
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rapor_Prestasi_${selectedStudentForDossier.name}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 15mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, sans-serif; }
            body { color: #000; font-size: 8.5pt; }
            .kop { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 12px; }
            .kop h2 { font-size: 12pt; font-weight: 900; }
            .identitas { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 8pt; }
            .identitas td { padding: 3px 0; }
            table.data { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 8pt; }
            table.data th, table.data td { border: 1px solid #444; padding: 4px 6px; }
            table.data th { background: #ecfdf5; }
            .ttd { display: flex; justify-content: space-between; margin-top: 30px; font-size: 8pt; text-align: center; }
            .ttd-col { width: 40%; }
            .ttd-space { height: 50px; }
          </style>
        </head>
        <body>
          <div class="kop">
            <h2>PONDOK PESANTREN CONDONG</h2>
            <p>BIRO PRESTASI SANTRI - RAPOR PENGHARGAAN & PRESTASI</p>
          </div>
          <table class="identitas">
            <tr>
              <td style="width: 100px; font-weight: bold;">Nama Santri</td><td>: ${selectedStudentForDossier.name}</td>
              <td style="width: 100px; font-weight: bold;">Kamar Asrama</td><td>: ${selectedStudentForDossier.dorm}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">NIS</td><td>: ${selectedStudentForDossier.nis}</td>
              <td style="font-weight: bold;">Kelas</td><td>: ${selectedStudentForDossier.class}</td>
            </tr>
          </table>
          <table class="data">
            <thead>
              <tr>
                <th style="width: 25px;">No</th>
                <th style="width: 75px;">Tanggal</th>
                <th>Nama Kejuaraan / Prestasi</th>
                <th style="width: 70px;">Tingkat</th>
                <th style="width: 45px;">Reward</th>
                <th>Bentuk Apresiasi</th>
              </tr>
            </thead>
            <tbody>
              ${studentDossierAchievements
                .map(
                  (a, i) => `
                <tr>
                  <td align="center">${i + 1}</td>
                  <td align="center">${new Date(a.event_date || a.created_at).toLocaleDateString("id-ID")}</td>
                  <td><b>${a.title}</b><div style="font-size: 7.5pt; color: #555;">Bidang: ${a.category}</div></td>
                  <td align="center">${a.level}</td>
                  <td align="center" style="font-weight: bold; color: #047857;">+${a.reward_points}</td>
                  <td>${a.appreciation || "Piagam Penghargaan"}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #f8fafc;">
                <td colspan="4" align="right">TOTAL REWARD POIN:</td>
                <td align="center" style="color: #047857;">+${dossierFilteredPoints}</td>
                <td>Total ${studentDossierAchievements.length} Capaian</td>
              </tr>
            </tfoot>
          </table>
          <div class="ttd">
            <div class="ttd-col">
              <p>Mengetahui,</p>
              <p><b>Wali Santri</b></p>
              <div class="ttd-space"></div>
              <p><u>( ............................................ )</u></p>
            </div>
            <div class="ttd-col">
              <p>Tasikmalaya, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p><b>Pembina Prestasi Santri</b></p>
              <div class="ttd-space"></div>
              <p><u>( Ust. Pembina Prestasi )</u></p>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 400);
  };

  // Action Handlers
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("achievements").delete().eq("id", itemToDelete.id);
      if (error) throw error;
      setAchievements((prev) => prev.filter((a) => a.id !== itemToDelete.id));
      setSelectedIds((prev) => prev.filter((id) => id !== itemToDelete.id));
      setItemToDelete(null);
    } catch (err: any) {
      alert("Gagal menghapus: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenEditModal = (a: AchievementRecord) => {
    setEditingItem(a);
    setEditError("");
    setEditTitle(a.title || "");
    setEditCategory(a.category || "Tahfidz / Al-Qur'an");
    setEditLevel(a.level || "Kabupaten / Kota");

    const rawDate = a.event_date ? a.event_date.slice(0, 10) : a.created_at ? a.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
    setEditEventDate(rawDate);

    setEditRewardPoints(Number(a.reward_points) || 20);
    setEditAppreciation(a.appreciation || "");
    setEditDescription(a.description || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editTitle.trim()) {
      setEditError("Nama kejuaraan / capaian prestasi wajib diisi.");
      return;
    }
    if (!editEventDate) {
      setEditError("Tanggal perolehan prestasi wajib ditentukan.");
      return;
    }

    setIsUpdating(true);
    setEditError("");
    try {
      const { error } = await supabase
        .from("achievements")
        .update({
          title: editTitle.trim(),
          category: editCategory,
          level: editLevel,
          event_date: editEventDate,
          reward_points: Number(editRewardPoints),
          appreciation: editAppreciation.trim(),
          description: editDescription.trim(),
        })
        .eq("id", editingItem.id);

      if (error) throw error;
      await fetchData();
      setEditingItem(null);
    } catch (err: any) {
      setEditError(err.message || "Gagal memperbarui catatan prestasi.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBatchDeleting(true);
    try {
      const { error } = await supabase.from("achievements").delete().in("id", selectedIds);
      if (error) throw error;
      setAchievements((prev) => prev.filter((a) => !selectedIds.includes(a.id)));
      setSelectedIds([]);
      setShowBatchDeleteModal(false);
    } catch (err: any) {
      alert("Gagal hapus massal: " + err.message);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans relative pb-24">
      {/* ================= HEADER HERO BANNER ================= */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-emerald-950 via-[#064e3b] to-teal-950 p-5 sm:p-7 text-white shadow-xl border border-emerald-500/30 print:hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5 min-w-0">
            <Link
              href="/dashboard"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition active:scale-90 shadow-sm backdrop-blur-md"
              title="Kembali ke Dashboard Utama"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
            </Link>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-emerald-500 to-teal-400 text-slate-950 shadow-md font-black">
              <Trophy className="h-5 w-5 stroke-[2.3]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-emerald-200 text-[9.5px] font-black uppercase tracking-wider backdrop-blur-xl">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  APRESIASI SANTRI
                </span>
                <span className="text-[10px] text-emerald-300 font-mono font-bold">
                  {achievements.length} Prestasi
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white mt-0.5 truncate">
                Pusat Prestasi Santri
              </h1>
            </div>
          </div>

          {/* Action Buttons Ringkas & Responsif */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="inline-flex items-center space-x-1.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-2 text-xs font-bold text-white transition active:scale-95 cursor-pointer backdrop-blur-md shadow-sm"
              title="Pindai QR KTS"
            >
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">Scan KTS</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center space-x-1.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-2 text-xs font-bold text-white transition active:scale-95 cursor-pointer backdrop-blur-md shadow-sm"
              title="Ekspor Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-300" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrintOfficialPDF}
              className="inline-flex items-center space-x-1.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-2 text-xs font-bold text-white transition active:scale-95 cursor-pointer backdrop-blur-md shadow-sm"
              title="Cetak PDF Resmi"
            >
              <Printer className="h-4 w-4 text-amber-300" />
              <span className="hidden sm:inline">Cetak PDF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true);
                setCreateError("");
                setSelectedStudentForCreate(null);
                setCreateSearchStudent("");
                setCreateTitle("");
                setCreateDescription("");
              }}
              className="inline-flex items-center space-x-1.5 rounded-2xl bg-gradient-to-r from-amber-400 via-emerald-500 to-teal-400 hover:from-amber-300 hover:to-teal-300 px-4 py-2 text-xs font-black text-slate-950 shadow-md transition active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.8]" />
              <span>Catat Prestasi</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= KARTU METRIK STATISTIK ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
        <div className="rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-black uppercase text-slate-400">Total Prestasi</span>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 font-mono">{stats.totalAchievements}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-black uppercase text-emerald-500">Reward Poin</span>
          <p className="text-2xl sm:text-3xl font-black text-emerald-500 mt-1 font-mono">+{stats.totalPointsAwarded}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-black uppercase text-sky-500">Nasional / Global</span>
          <p className="text-2xl sm:text-3xl font-black text-sky-500 mt-1 font-mono">{stats.nationalGlobalCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-black uppercase text-teal-500">Tahfidz Quran</span>
          <p className="text-2xl sm:text-3xl font-black text-teal-500 mt-1 font-mono">{stats.tahfidzCount}</p>
        </div>
      </div>

      {/* ================= TOOLBAR FILTER CERDAS ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-3 sm:p-4 shadow-sm backdrop-blur-md print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama santri, NIS, atau nama kejuaraan..."
            className="h-10 w-full rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            className={`inline-flex items-center space-x-2 rounded-2xl h-10 px-4 text-xs font-bold transition active:scale-95 cursor-pointer border ${
              activeFiltersCount > 0
                ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30"
                : "border-slate-200 dark:border-emerald-900/60 bg-slate-50/80 dark:bg-emerald-950/30 text-slate-700 dark:text-slate-200 hover:border-emerald-500"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filter Kriteria</span>
            {activeFiltersCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-900 font-black text-[10px]">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="h-10 w-10 flex items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition active:scale-95 cursor-pointer"
              title="Reset Filter"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={fetchData}
            className="h-10 w-10 flex items-center justify-center rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
            title="Segarkan Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* ================= MODAL FILTER KRITERIA LENGKAP ================= */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-white space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-black text-sm">
                <Filter className="h-4 w-4" />
                <span>Filter Data Prestasi</span>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Kategori Bidang</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full h-10 rounded-xl bg-slate-950 border border-slate-800 px-3 font-bold text-white outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="Tahfidz / Al-Qur'an">Tahfidz / Al-Qur&apos;an</option>
                  <option value="Bahasa / Pidato">Bahasa / Pidato</option>
                  <option value="Akademik & Sains">Akademik &amp; Sains</option>
                  <option value="Keorganisasian & Kepemimpinan">Keorganisasian</option>
                  <option value="Olahraga & Seni">Olahraga &amp; Seni</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Tingkat Wilayah</label>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="w-full h-10 rounded-xl bg-slate-950 border border-slate-800 px-3 font-bold text-white outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">Semua Tingkat</option>
                  <option value="Internal Pondok">Internal Pondok</option>
                  <option value="Kabupaten / Kota">Kabupaten / Kota</option>
                  <option value="Provinsi">Provinsi</option>
                  <option value="Nasional">Nasional</option>
                  <option value="Internasional">Internasional</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Kelas Santri</label>
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="w-full h-10 rounded-xl bg-slate-950 border border-slate-800 px-3 font-bold text-white outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">Semua Kelas</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      Kelas {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Kamar Asrama</label>
                <select
                  value={filterDorm}
                  onChange={(e) => setFilterDorm(e.target.value)}
                  className="w-full h-10 rounded-xl bg-slate-950 border border-slate-800 px-3 font-bold text-white outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">Semua Asrama / Kamar</option>
                  {availableDorms.map((dorm) => (
                    <option key={dorm} value={dorm}>
                      {dorm}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Rentang Waktu</label>
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value as any)}
                  className="w-full h-10 rounded-xl bg-slate-950 border border-slate-800 px-3 font-bold text-white outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">Semua Waktu</option>
                  <option value="7days">1 Minggu Terakhir (7 Hari)</option>
                  <option value="30days">1 Bulan Terakhir (30 Hari)</option>
                  <option value="semester">1 Semester Terakhir (6 Bulan)</option>
                  <option value="custom">Rentang Tanggal Khusus...</option>
                </select>
              </div>

              {filterPeriod === "custom" && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="h-9 rounded-xl border border-slate-800 bg-slate-950 px-2.5 text-xs text-white outline-none"
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="h-9 rounded-xl border border-slate-800 bg-slate-950 px-2.5 text-xs text-white outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={resetAllFilters}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition active:scale-95 text-xs cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black hover:bg-emerald-400 transition active:scale-95 text-xs cursor-pointer"
              >
                Terapkan Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TABEL DATA PRESTASI ================= */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] shadow-xl backdrop-blur-xl print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-emerald-900/40 bg-slate-50/90 dark:bg-emerald-950/40 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                <th className="py-4 px-3 w-10 text-center">
                  <button type="button" onClick={handleToggleSelectAll} className="p-1 cursor-pointer">
                    {isAllFilteredSelected ? <CheckSquare className="h-4 w-4 text-emerald-500" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="py-4 px-4 font-bold">Santri Berprestasi</th>
                <th className="py-4 px-4 font-bold">Nama Kejuaraan / Prestasi</th>
                <th className="py-4 px-4 text-center font-bold">Tingkat</th>
                <th className="py-4 px-4 text-center font-bold">Reward Poin</th>
                <th className="py-4 px-4 font-bold">Bentuk Apresiasi</th>
                <th className="py-4 px-4 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/30 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    <span>Memuat data prestasi...</span>
                  </td>
                </tr>
              ) : filteredAchievements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Tidak ada catatan prestasi yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredAchievements.map((a) => {
                  const isSelected = selectedIds.includes(a.id);
                  const meta = studentsMap[a.nis] || {};
                  return (
                    <tr key={a.id} className={`hover:bg-emerald-500/[0.03] transition ${isSelected ? "bg-emerald-500/10" : ""}`}>
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(a.id)}
                          className="rounded text-emerald-600 h-4 w-4"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleOpenStudentDossier(a)}
                          className="font-bold text-sm text-slate-900 dark:text-white hover:underline text-left block"
                        >
                          {a.student_name}
                        </button>
                        <p className="text-[11px] text-slate-400 font-mono">
                          NIS: {a.nis} • {meta.class || "-"} • {meta.dorm || "-"}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900 dark:text-white">{a.title}</p>
                        <span className="text-[10px] text-slate-400">
                          {a.category} • {new Date(a.event_date || a.created_at).toLocaleDateString("id-ID")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-emerald-950/40 text-slate-700 dark:text-slate-300">
                          {a.level}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full text-xs">
                          +{a.reward_points}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">{a.appreciation || "Piagam Penghargaan"}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenStudentDossier(a)}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-emerald-900/40 text-slate-500 hover:text-cyan-500"
                            title="Rapor Prestasi"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(a)}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-emerald-900/40 text-slate-500 hover:text-amber-500"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(a)}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-emerald-900/40 text-rose-500 hover:bg-rose-500/10"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= FLOATING ACTION BAR ================= */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 border border-slate-800 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
          <span className="text-xs font-bold">{selectedIds.length} Prestasi Dipilih</span>
          <button
            type="button"
            onClick={() => setShowBatchDeleteModal(true)}
            className="px-3.5 py-1.5 bg-rose-600 text-white font-bold rounded-xl text-xs"
          >
            Hapus Massal
          </button>
          <button type="button" onClick={() => setSelectedIds([])} className="p-1 text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ================= MODAL DOSSIER SANTRI ================= */}
      {selectedStudentForDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base">{selectedStudentForDossier.name}</h3>
                <p className="text-xs text-slate-400">
                  NIS: {selectedStudentForDossier.nis} • Kelas: {selectedStudentForDossier.class} • Kamar: {selectedStudentForDossier.dorm}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForDossier(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 text-xs">
              {studentDossierAchievements.map((a, idx) => (
                <div key={a.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                  <div>
                    <p className="font-bold">{a.title}</p>
                    <p className="text-[11px] text-slate-400">Tingkat: {a.level} • {a.category}</p>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold">+{a.reward_points} Poin</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handlePrintStudentDossier}
                className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Rapor Prestasi</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedStudentForDossier(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Scanner QR */}
      <QRScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
        title="Pemindai KTS Santri (Prestasi)"
        description="Arahkan kamera ke QR Code KTS santri untuk melihat daftar raihan prestasi"
      />
    </div>
  );
}