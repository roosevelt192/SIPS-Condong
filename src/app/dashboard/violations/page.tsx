"use client";

// =============================================================================
// 1. IMPORT DEPENDENCIES & ICONS
// =============================================================================
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import ExcelJS from "exceljs";
import {
  ShieldAlert,
  Plus,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Scale,
  Edit,
  Trash2,
  FileText,
  X,
  Calendar,
  CheckSquare,
  Square,
  Check,
  Layers,
  FileSpreadsheet,
  Printer,
  History,
  User,
  Phone,
  Home,
  MapPin,
  GraduationCap,
  QrCode,
  Sparkles,
  ArrowLeft,
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
interface Violation {
  id: string;
  student_id: string;
  student_name: string;
  nis: string;
  category: "Ringan" | "Sedang" | "Berat";
  violation_name: string;
  points: number;
  description?: string;
  sanction?: string;
  status: "Proses" | "Ditindak" | "Selesai";
  recorded_by?: string;
  document_url?: string;
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
  totalPoints: number;
  violationsCount: number;
}

export default function ViolationsDashboardPage() {
  // ===========================================================================
  // 3. STATE MANAGEMENT
  // ===========================================================================
  const [violations, setViolations] = useState<Violation[]>([]);
  const [studentsMap, setStudentsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Scanner Modal State
  const [showScanner, setShowScanner] = useState(false);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "Proses" | "Ditindak" | "Selesai">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterDorm, setFilterDorm] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState<"all" | "7days" | "30days" | "semester" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "points_high" | "points_low" | "name_asc">("newest");
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Selection State (Multi Checkbox)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Single Action States
  const [itemToDelete, setItemToDelete] = useState<Violation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingItem, setEditingItem] = useState<Violation | null>(null);
  const [editStatus, setEditStatus] = useState<"Proses" | "Ditindak" | "Selesai">("Proses");
  const [editSanction, setEditSanction] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Batch (Massal) States
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  const [batchStatus, setBatchStatus] = useState<"Proses" | "Ditindak" | "Selesai">("Ditindak");
  const [batchSanction, setBatchSanction] = useState("");
  const [updateSanctionToo, setUpdateSanctionToo] = useState(false);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Individual Student Tracking (Dossier Modal)
  const [selectedStudentForDossier, setSelectedStudentForDossier] = useState<StudentSummary | null>(null);
  const [dossierPeriodFilter, setDossierPeriodFilter] = useState<"all" | "7days" | "30days" | "semester">("all");

  // ===========================================================================
  // 4. FETCH DATA VIOLATIONS & STUDENTS
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

      const { data: vData, error: vError } = await supabase
        .from("violations")
        .select("*")
        .order("created_at", { ascending: false });

      if (vError) throw vError;
      
      const normalizedVData = (vData || []).map((v: any) => ({
        ...v,
        id: String(v.id),
      }));

      setViolations(normalizedVData);
      setSelectedIds([]);
    } catch (err: any) {
      console.warn("Gagal memuat catatan pelanggaran:", err.message);
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
    const targetNis = (nis || searchKey).trim();

    let studentMeta = studentsMap[targetNis];

    if (!studentMeta && targetNis) {
      const { data: st } = await supabase
        .from("students")
        .select("*")
        .or(`nis.eq.${targetNis},id.eq.${id || targetNis}`)
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
      const allStudentViolations = violations.filter(
        (item) => item.nis === targetNis || item.student_id === studentMeta.id
      );
      const totalPts = allStudentViolations.reduce(
        (acc, curr) => acc + (Number(curr.points) || 0),
        0
      );

      setSelectedStudentForDossier({
        id: studentMeta.id,
        nis: targetNis,
        name: studentMeta.name,
        class: studentMeta.class,
        dorm: studentMeta.dorm,
        consulate: studentMeta.consulate,
        guardian_name: studentMeta.guardian_name,
        guardian_phone: studentMeta.phone,
        photo_url: studentMeta.photo_url,
        totalPoints: totalPts,
        violationsCount: allStudentViolations.length,
      });
      setDossierPeriodFilter("all");
    } else {
      playScanSound("error");
      setSearchQuery(targetNis);
    }
  };

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
    if (filterClass !== "all") count++;
    if (filterDorm !== "all") count++;
    if (filterPeriod !== "all") count++;
    return count;
  }, [filterCategory, filterClass, filterDorm, filterPeriod]);

  const resetAllFilters = () => {
    setFilterCategory("all");
    setFilterClass("all");
    setFilterDorm("all");
    setFilterPeriod("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setSearchQuery("");
  };

  // ===========================================================================
  // 6. FILTERING, PERIOD & SORTING LOGIC
  // ===========================================================================
  const filteredViolations = useMemo(() => {
    const now = new Date();

    return violations
      .filter((v) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          q === "" ||
          v.student_name.toLowerCase().includes(q) ||
          v.nis.toLowerCase().includes(q) ||
          v.violation_name.toLowerCase().includes(q);

        const matchesTab = activeTab === "all" || v.status === activeTab;
        const matchesCategory = filterCategory === "all" || v.category === filterCategory;

        const meta = studentsMap[v.nis] || {};
        const matchesClass = filterClass === "all" || meta.class === filterClass;
        const matchesDorm = filterDorm === "all" || meta.dorm === filterDorm;

        let matchesPeriod = true;
        const createdAt = new Date(v.created_at);

        if (filterPeriod === "7days") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          matchesPeriod = createdAt >= sevenDaysAgo;
        } else if (filterPeriod === "30days") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          matchesPeriod = createdAt >= thirtyDaysAgo;
        } else if (filterPeriod === "semester") {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(now.getMonth() - 6);
          matchesPeriod = createdAt >= sixMonthsAgo;
        } else if (filterPeriod === "custom") {
          if (customStartDate) {
            matchesPeriod = matchesPeriod && createdAt >= new Date(`${customStartDate}T00:00:00`);
          }
          if (customEndDate) {
            matchesPeriod = matchesPeriod && createdAt <= new Date(`${customEndDate}T23:59:59`);
          }
        }

        return matchesSearch && matchesTab && matchesCategory && matchesClass && matchesDorm && matchesPeriod;
      })
      .sort((a, b) => {
        if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortBy === "points_high") return Number(b.points) - Number(a.points);
        if (sortBy === "points_low") return Number(a.points) - Number(b.points);
        if (sortBy === "name_asc") return a.student_name.localeCompare(b.student_name);
        return 0;
      });
  }, [violations, searchQuery, activeTab, filterCategory, filterClass, filterDorm, filterPeriod, customStartDate, customEndDate, sortBy, studentsMap]);

  const stats = useMemo(() => {
    const totalCases = violations.length;
    const totalPoints = violations.reduce((acc, curr) => acc + (Number(curr.points) || 0), 0);
    const inProcess = violations.filter((v) => v.status === "Proses").length;
    const heavyCases = violations.filter((v) => v.category === "Berat").length;
    return { totalCases, totalPoints, inProcess, heavyCases };
  }, [violations]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredViolations.length === 0) return false;
    return filteredViolations.every((v) => selectedIds.includes(String(v.id)));
  }, [filteredViolations, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredViolations.map((v) => String(v.id)));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...filteredViolations.map((v) => String(v.id))]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleToggleSelect = (id: string) => {
    const targetId = String(id);
    setSelectedIds((prev) =>
      prev.includes(targetId) ? prev.filter((i) => i !== targetId) : [...prev, targetId]
    );
  };

  // ===========================================================================
  // 7. EXPORT EXCEL PROFESIONAL (EXCELJS)
  // ===========================================================================
  const handleExportExcel = async () => {
    if (filteredViolations.length === 0) {
      alert("Tidak ada data pelanggaran untuk diekspor.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SIPS Condong - Bagian Pengasuhan";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Rekap_Pelanggaran", {
      views: [{ state: "frozen", ySplit: 4, xSplit: 3 }],
    });

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "CBD5E1" } },
      left: { style: "thin", color: { argb: "CBD5E1" } },
      bottom: { style: "thin", color: { argb: "CBD5E1" } },
      right: { style: "thin", color: { argb: "CBD5E1" } },
    };

    ws.mergeCells("A1:K1");
    const titleCell = ws.getCell("A1");
    titleCell.value = "PONDOK PESANTREN CONDONG - REKAPITULASI KEDISIPLINAN SANTRI";
    titleCell.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "881337" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 24;

    ws.mergeCells("A2:K2");
    const subCell = ws.getCell("A2");
    subCell.value = `Dicetak: ${new Date().toLocaleDateString("id-ID", { dateStyle: "full" })} • Total: ${filteredViolations.length} Kasus Pelanggaran`;
    subCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "881337" } };
    subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4E6" } };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    const headers = ["NO", "TANGGAL", "NIS", "NAMA SANTRI", "KELAS", "KAMAR", "KONSULAT", "KATEGORI", "BENTUK PELANGGARAN", "POIN", "STATUS"];
    const hRow = ws.getRow(4);
    hRow.values = headers;
    hRow.height = 24;
    hRow.eachCell((c) => {
      c.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "9F1239" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = borderStyle;
    });

    filteredViolations.forEach((v, idx) => {
      const meta = studentsMap[v.nis] || {};
      const row = ws.getRow(idx + 5);
      row.values = [
        idx + 1,
        new Date(v.created_at).toLocaleDateString("id-ID"),
        v.nis,
        v.student_name,
        meta.class || "-",
        meta.dorm || "-",
        meta.consulate || "-",
        v.category,
        v.violation_name,
        v.points,
        v.status,
      ];
      row.height = 19;
      const isEven = idx % 2 === 1;
      row.eachCell((cell, colNum) => {
        cell.font = { name: "Segoe UI", size: 9 };
        cell.border = borderStyle;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEven ? "FFF1F2" : "FFFFFF" } };
        cell.alignment = { horizontal: [1, 2, 5, 8, 10, 11].includes(colNum) ? "center" : "left", vertical: "middle" };
      });
    });

    ws.columns = [
      { width: 6 }, { width: 13 }, { width: 14 }, { width: 30 }, { width: 12 }, { width: 20 },
      { width: 20 }, { width: 12 }, { width: 34 }, { width: 10 }, { width: 14 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rekap_Pelanggaran_Santri_${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ===========================================================================
  // 8. CETAK LAPORAN PDF RESMI A4 (ISOLATED ENGINE)
  // ===========================================================================
  const handlePrintOfficialPDF = () => {
    if (filteredViolations.length === 0) {
      alert("Tidak ada data untuk dicetak.");
      return;
    }

    const existingIframe = document.getElementById("sips-violations-pdf-frame");
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "sips-violations-pdf-frame";
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
          <title>Laporan_Kedisiplinan_${new Date().toISOString().split("T")[0]}</title>
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
            th { background-color: #ffe4e6; font-weight: bold; text-align: center; }
            .ttd { display: flex; justify-content: space-between; margin-top: 25px; font-size: 8pt; text-align: center; }
            .ttd-col { width: 40%; }
            .ttd-space { height: 45px; }
          </style>
        </head>
        <body>
          <div class="kop">
            <h2>PONDOK PESANTREN CONDONG</h2>
            <p>BAGIAN PENGASUHAN SANTRI - TARBIYAH & KEDISIPLINAN</p>
            <p style="font-size: 7pt; color: #666;">Jl. Condong No. 01, Setianagara, Cibeureum, Kota Tasikmalaya, Jawa Barat</p>
          </div>
          <div class="meta">
            <div>
              <p><b>Filter Kategori:</b> ${filterCategory.toUpperCase()}</p>
              <p><b>Filter Status:</b> ${activeTab.toUpperCase()}</p>
            </div>
            <div style="text-align: right;">
              <p><b>Total Kasus:</b> ${filteredViolations.length} Pelanggaran</p>
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
                <th>Bentuk Pelanggaran</th>
                <th style="width: 35px;">Poin</th>
                <th>Bentuk Sanksi / Takzir</th>
                <th style="width: 55px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredViolations
                .map((v, i) => {
                  const meta = studentsMap[v.nis] || {};
                  return `
                    <tr>
                      <td align="center">${i + 1}</td>
                      <td align="center">${new Date(v.created_at).toLocaleDateString("id-ID")}</td>
                      <td align="center">${v.nis}</td>
                      <td><b>${v.student_name}</b></td>
                      <td align="center">${meta.class || "-"}</td>
                      <td>${v.violation_name}</td>
                      <td align="center" style="font-weight: bold; color: #9f1239;">+${v.points}</td>
                      <td>${v.sanction || "-"}</td>
                      <td align="center">${v.status}</td>
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
              <p><b>Petugas Kedisiplinan Santri</b></p>
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
  // 9. INDIVIDUAL TRACKING & RAPOR SANTRI
  // ===========================================================================
  const handleOpenStudentDossier = (v: Violation) => {
    const meta = studentsMap[v.nis] || {};
    const allStudentViolations = violations.filter((item) => item.nis === v.nis);
    const totalPts = allStudentViolations.reduce((acc, curr) => acc + (Number(curr.points) || 0), 0);

    setSelectedStudentForDossier({
      id: v.student_id,
      nis: v.nis,
      name: v.student_name,
      class: meta.class || "-",
      dorm: meta.dorm || "-",
      consulate: meta.consulate || "-",
      guardian_name: meta.guardian_name || "-",
      guardian_phone: meta.phone || "-",
      photo_url: meta.photo_url || null,
      totalPoints: totalPts,
      violationsCount: allStudentViolations.length,
    });
    setDossierPeriodFilter("all");
  };

  const studentDossierViolations = useMemo(() => {
    if (!selectedStudentForDossier) return [];
    const now = new Date();

    return violations.filter((v) => {
      if (v.nis !== selectedStudentForDossier.nis) return false;
      const createdAt = new Date(v.created_at);

      if (dossierPeriodFilter === "7days") {
        const d = new Date();
        d.setDate(now.getDate() - 7);
        return createdAt >= d;
      }
      if (dossierPeriodFilter === "30days") {
        const d = new Date();
        d.setDate(now.getDate() - 30);
        return createdAt >= d;
      }
      if (dossierPeriodFilter === "semester") {
        const d = new Date();
        d.setMonth(now.getMonth() - 6);
        return createdAt >= d;
      }
      return true;
    });
  }, [violations, selectedStudentForDossier, dossierPeriodFilter]);

  const dossierFilteredPoints = useMemo(() => {
    return studentDossierViolations.reduce((acc, curr) => acc + (Number(curr.points) || 0), 0);
  }, [studentDossierViolations]);

  const handlePrintStudentDossier = () => {
    if (!selectedStudentForDossier) return;
    const existingIframe = document.getElementById("sips-dossier-frame");
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "sips-dossier-frame";
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
          <title>Rapor_Disiplin_${selectedStudentForDossier.name}</title>
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
            table.data th { background: #ffe4e6; }
            .ttd { display: flex; justify-content: space-between; margin-top: 30px; font-size: 8pt; text-align: center; }
            .ttd-col { width: 40%; }
            .ttd-space { height: 50px; }
          </style>
        </head>
        <body>
          <div class="kop">
            <h2>PONDOK PESANTREN CONDONG</h2>
            <p>BAGIAN PENGASUHAN SANTRI - RAPOR KEDISIPLINAN</p>
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
                <th>Pelanggaran</th>
                <th style="width: 60px;">Kategori</th>
                <th style="width: 40px;">Poin</th>
                <th>Takzir / Sanksi</th>
                <th style="width: 60px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${studentDossierViolations
                .map(
                  (v, i) => `
                <tr>
                  <td align="center">${i + 1}</td>
                  <td align="center">${new Date(v.created_at).toLocaleDateString("id-ID")}</td>
                  <td><b>${v.violation_name}</b></td>
                  <td align="center">${v.category}</td>
                  <td align="center" style="font-weight: bold; color: #9f1239;">+${v.points}</td>
                  <td>${v.sanction || "-"}</td>
                  <td align="center">${v.status}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #f8fafc;">
                <td colspan="4" align="right">TOTAL AKUMULASI POIN:</td>
                <td align="center" style="color: #9f1239;">+${dossierFilteredPoints}</td>
                <td colspan="2">Total ${studentDossierViolations.length} Kasus</td>
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
              <p><b>Pengasuhan Santri</b></p>
              <div class="ttd-space"></div>
              <p><u>( Ust. Pengasuhan Santri )</u></p>
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
  // ACTION HANDLERS
  // ===========================================================================
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("violations")
        .delete()
        .eq("id", itemToDelete.id);

      if (error) throw error;
      playScanSound("success");
      setViolations((prev) => prev.filter((v) => String(v.id) !== String(itemToDelete.id)));
      setSelectedIds((prev) => prev.filter((id) => id !== String(itemToDelete.id)));
      setItemToDelete(null);
    } catch (err: any) {
      playScanSound("error");
      alert("Gagal menghapus: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("violations")
        .update({ status: editStatus, sanction: editSanction.trim() })
        .eq("id", editingItem.id);

      if (error) throw error;
      playScanSound("success");
      await fetchData();
      setEditingItem(null);
    } catch (err: any) {
      playScanSound("error");
      alert("Gagal memperbarui: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveBatchEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const payload: any = { status: batchStatus };
      if (updateSanctionToo && batchSanction.trim()) payload.sanction = batchSanction.trim();
      
      const { error } = await supabase
        .from("violations")
        .update(payload)
        .in("id", selectedIds);

      if (error) throw error;
      playScanSound("success");
      await fetchData();
      setShowBatchEditModal(false);
      setSelectedIds([]);
    } catch (err: any) {
      playScanSound("error");
      alert("Gagal edit massal: " + err.message);
    } finally {
      setIsBatchUpdating(false);
    }
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBatchDeleting(true);
    try {
      const { error } = await supabase
        .from("violations")
        .delete()
        .in("id", selectedIds);

      if (error) throw error;
      playScanSound("success");
      setViolations((prev) => prev.filter((v) => !selectedIds.includes(String(v.id))));
      setSelectedIds([]);
      setShowBatchDeleteModal(false);
    } catch (err: any) {
      playScanSound("error");
      alert("Gagal hapus massal: " + err.message);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans relative pb-28">
      {/* ================= HEADER HERO BANNER ================= */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-rose-950 via-[#7f1d1d] to-rose-900 p-5 sm:p-7 text-white shadow-xl border border-rose-500/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5 min-w-0">
            <Link
              href="/dashboard"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition active:scale-90 shadow-sm backdrop-blur-md"
              title="Kembali ke Dashboard"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
            </Link>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-rose-500 to-red-600 text-white shadow-md font-black">
              <ShieldAlert className="h-5 w-5 stroke-[2.4]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-rose-200 text-[9.5px] font-black uppercase tracking-wider backdrop-blur-xl">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  TARBIYAH &amp; DISIPLIN
                </span>
                <span className="text-[10px] text-rose-300 font-mono font-bold">
                  {violations.length} Kasus
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white mt-0.5 truncate">
                Pelanggaran &amp; Kedisiplinan
              </h1>
            </div>
          </div>

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

            <Link
              href="/dashboard/violations/create"
              className="inline-flex items-center space-x-1.5 rounded-2xl bg-gradient-to-r from-amber-400 via-rose-500 to-red-500 hover:from-amber-300 hover:to-red-400 px-4 py-2 text-xs font-black text-slate-950 shadow-md transition active:scale-95 whitespace-nowrap"
            >
              <Plus className="h-4 w-4 stroke-[2.8]" />
              <span>Catat Pelanggaran</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ================= METRIK KEDISIPLINAN ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-3xl border border-slate-200/80 dark:border-rose-900/40 bg-white/90 dark:bg-[#1a0f12] p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-black uppercase text-slate-400">Total Kasus</span>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 font-mono">{stats.totalCases}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 dark:border-rose-900/40 bg-white/90 dark:bg-[#1a0f12] p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-black uppercase text-amber-500">Beban Poin</span>
          <p className="text-2xl sm:text-3xl font-black text-amber-500 mt-1 font-mono">{stats.totalPoints}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 dark:border-rose-900/40 bg-white/90 dark:bg-[#1a0f12] p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-black uppercase text-cyan-500">Dalam Proses</span>
          <p className="text-2xl sm:text-3xl font-black text-cyan-600 dark:text-cyan-400 mt-1 font-mono">{stats.inProcess}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 dark:border-rose-900/40 bg-white/90 dark:bg-[#1a0f12] p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-black uppercase text-rose-500">Kasus Berat</span>
          <p className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">{stats.heavyCases}</p>
        </div>
      </div>

      {/* ================= TOOLBAR FILTER CERDAS ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl border border-slate-200/80 dark:border-rose-900/40 bg-white/90 dark:bg-[#1a0f12] p-3 sm:p-4 shadow-sm backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari santri, NIS, atau bentuk pelanggaran..."
            className="h-10 w-full rounded-2xl border border-slate-200 dark:border-rose-900/60 bg-slate-50 dark:bg-rose-950/30 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-rose-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-100 dark:bg-rose-950/40 p-1 rounded-2xl border border-slate-200 dark:border-rose-900/40 text-xs font-bold">
            {[
              { id: "all", label: "Semua" },
              { id: "Proses", label: "Proses" },
              { id: "Ditindak", label: "Ditindak" },
              { id: "Selesai", label: "Selesai" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === tab.id ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            className={`inline-flex items-center space-x-2 rounded-2xl h-10 px-4 text-xs font-bold transition active:scale-95 cursor-pointer border ${
              activeFiltersCount > 0
                ? "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30"
                : "border-slate-200 dark:border-rose-900/60 bg-slate-50/80 dark:bg-rose-950/30 text-slate-700 dark:text-slate-200 hover:border-rose-500"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filter</span>
            {activeFiltersCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-rose-900 font-black text-[10px]">
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
            className="h-10 w-10 flex items-center justify-center rounded-2xl border border-slate-200 dark:border-rose-900/60 bg-slate-50 dark:bg-rose-950/30 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
            title="Segarkan Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-rose-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* ================= MODAL FILTER KRITERIA LENGKAP ================= */}
      {showFilterModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-white space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 relative z-[101]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-rose-400 font-black text-sm">
                <Filter className="h-4 w-4" />
                <span>Filter Data Pelanggaran</span>
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
                <label className="font-bold text-slate-300">Kategori Pelanggaran</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full h-10 rounded-xl bg-slate-950 border border-slate-800 px-3 font-bold text-white outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="Ringan">Kategori: Ringan</option>
                  <option value="Sedang">Kategori: Sedang</option>
                  <option value="Berat">Kategori: Berat</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Kelas Santri</label>
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="w-full h-10 rounded-xl bg-slate-950 border border-slate-800 px-3 font-bold text-white outline-none focus:border-rose-500 cursor-pointer"
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
                  className="w-full h-10 rounded-xl bg-slate-950 border border-slate-800 px-3 font-bold text-white outline-none focus:border-rose-500 cursor-pointer"
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
                <label className="font-bold text-slate-300">Rentang Periode Waktu</label>
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value as any)}
                  className="w-full h-10 rounded-xl bg-slate-950 border border-slate-800 px-3 font-bold text-white outline-none focus:border-rose-500 cursor-pointer"
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
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-slate-950 font-black hover:bg-rose-400 transition active:scale-95 text-xs cursor-pointer"
              >
                Terapkan Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DAFTAR TABEL PELANGGARAN ================= */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-rose-900/40 bg-white/90 dark:bg-[#1a0f12] shadow-xl backdrop-blur-xl relative z-10">
        {/* Tampilan Mobile */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-rose-900/30">
          <div className="p-3 bg-slate-50 dark:bg-rose-950/40 flex items-center justify-between border-b border-slate-200 dark:border-rose-900/40 text-xs font-bold">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="inline-flex items-center space-x-2 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              {isAllFilteredSelected ? <CheckSquare className="h-4 w-4 text-rose-500" /> : <Square className="h-4 w-4" />}
              <span>Pilih Semua ({filteredViolations.length})</span>
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-rose-600 mb-2" />
              <span className="text-xs">Memuat data kedisiplinan...</span>
            </div>
          ) : filteredViolations.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">Tidak ada catatan pelanggaran.</div>
          ) : (
            filteredViolations.map((v) => {
              const isSelected = selectedIds.includes(String(v.id));
              const meta = studentsMap[v.nis] || {};
              return (
                <div key={v.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(String(v.id))}
                        className="rounded text-rose-600 h-4 w-4 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => handleOpenStudentDossier(v)}
                          className="font-bold text-sm text-slate-900 dark:text-white truncate hover:underline text-left block cursor-pointer"
                        >
                          {v.student_name}
                        </button>
                        <p className="text-[11px] text-slate-400 font-mono">
                          NIS: {v.nis} • {meta.class || "-"}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono font-black text-rose-600 text-xs bg-rose-500/10 px-2 py-0.5 rounded-md">
                      +{v.points}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-rose-950/20 p-2.5 rounded-xl text-xs space-y-1 border border-slate-100 dark:border-rose-900/30">
                    <p className="font-bold text-slate-900 dark:text-white">{v.violation_name}</p>
                    <p className="text-[11px] text-slate-500">Takzir: {v.sanction || "-"}</p>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(v.created_at).toLocaleDateString("id-ID")} • Status: <strong>{v.status}</strong>
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleOpenStudentDossier(v)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-rose-900/40 text-slate-500 cursor-pointer"
                        title="Rekam Jejak"
                      >
                        <History className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(v);
                          setEditStatus(v.status);
                          setEditSanction(v.sanction || "");
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-rose-900/40 text-slate-500 cursor-pointer"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemToDelete(v)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-rose-900/40 text-rose-500 cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Tampilan Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-rose-900/40 bg-slate-50/90 dark:bg-rose-950/40 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                <th className="py-4 px-3 w-10 text-center">
                  <button type="button" onClick={handleToggleSelectAll} className="p-1 cursor-pointer">
                    {isAllFilteredSelected ? <CheckSquare className="h-4 w-4 text-rose-500" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="py-4 px-4 font-bold">Santri &amp; Identitas</th>
                <th className="py-4 px-4 font-bold">Pelanggaran &amp; Kategori</th>
                <th className="py-4 px-4 font-bold text-center">Beban Poin</th>
                <th className="py-4 px-4 font-bold">Bentuk Sanksi / Takzir</th>
                <th className="py-4 px-4 text-center font-bold">Status</th>
                <th className="py-4 px-4 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-rose-900/30 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-rose-600 mb-2" />
                    <span>Memuat data kedisiplinan...</span>
                  </td>
                </tr>
              ) : filteredViolations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Tidak ada catatan pelanggaran yang cocok.
                  </td>
                </tr>
              ) : (
                filteredViolations.map((v) => {
                  const isSelected = selectedIds.includes(String(v.id));
                  const meta = studentsMap[v.nis] || {};
                  return (
                    <tr key={v.id} className={`hover:bg-rose-500/[0.03] transition ${isSelected ? "bg-rose-500/10" : ""}`}>
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(String(v.id))}
                          className="rounded text-rose-600 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleOpenStudentDossier(v)}
                          className="font-bold text-sm text-slate-900 dark:text-white hover:underline text-left block cursor-pointer"
                        >
                          {v.student_name}
                        </button>
                        <p className="text-[11px] text-slate-400 font-mono">
                          NIS: {v.nis} • {meta.class || "-"} • {meta.dorm || "-"}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900 dark:text-white">{v.violation_name}</p>
                        <span className="text-[10px] text-slate-400">
                          {v.category} • {new Date(v.created_at).toLocaleDateString("id-ID")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-bold text-rose-600 bg-rose-500/10 px-2.5 py-0.5 rounded-full text-xs">
                          +{v.points}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">{v.sanction || "-"}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-rose-950/40 text-slate-700 dark:text-slate-300">
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenStudentDossier(v)}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-rose-900/40 text-slate-500 hover:text-cyan-500 cursor-pointer"
                            title="Rekam Jejak"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(v);
                              setEditStatus(v.status);
                              setEditSanction(v.sanction || "");
                            }}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-rose-900/40 text-slate-500 hover:text-amber-500 cursor-pointer"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(v)}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-rose-900/40 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 border border-slate-800 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <span className="text-xs font-bold">{selectedIds.length} Kasus Dipilih</span>
          <button
            type="button"
            onClick={() => setShowBatchEditModal(true)}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer active:scale-95"
          >
            Edit Status
          </button>
          <button
            type="button"
            onClick={() => setShowBatchDeleteModal(true)}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs transition cursor-pointer active:scale-95"
          >
            Hapus
          </button>
          <button 
            type="button" 
            onClick={() => setSelectedIds([])} 
            className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
            title="Batal Pilih"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ================= MODAL DOSSIER SANTRI ================= */}
      {selectedStudentForDossier && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-white space-y-4 shadow-2xl relative z-[101]">
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
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 text-xs">
              {studentDossierViolations.map((v) => (
                <div key={v.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                  <div>
                    <p className="font-bold">{v.violation_name}</p>
                    <p className="text-[11px] text-slate-400">Takzir: {v.sanction || "-"}</p>
                  </div>
                  <span className="font-mono text-rose-400 font-bold">+{v.points} Poin</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handlePrintStudentDossier}
                className="px-4 py-2 bg-rose-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Rapor</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedStudentForDossier(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT SINGLE ================= */}
      {editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900/95 p-6 text-white space-y-4 shadow-2xl animate-in zoom-in-95 relative z-[101]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Edit className="h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-sm text-white">Tindak Lanjut Pelanggaran</h3>
                  <p className="text-[11px] text-slate-400">{editingItem.student_name} ({editingItem.nis})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Status Pembinaan</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-bold text-amber-400 outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="Proses">Dalam Proses</option>
                  <option value="Ditindak">Sudah Ditindak</option>
                  <option value="Selesai">Selesai Dibina</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Bentuk Sanksi / Takzir</label>
                <textarea
                  rows={3}
                  value={editSanction}
                  onChange={(e) => setEditSanction(e.target.value)}
                  placeholder="Keterangan takzir atau tindak lanjut pembinaan..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT MASSAL ================= */}
      {showBatchEditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 p-6 text-white space-y-4 shadow-2xl animate-in zoom-in-95 relative z-[101]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Edit {selectedIds.length} Pelanggaran Sekaligus</h3>
                  <p className="text-[11px] text-slate-400">Pembaruan status massal santri terpilih</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchEditModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBatchEdit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Ubah Status Pembinaan Menjadi:</label>
                <select
                  value={batchStatus}
                  onChange={(e) => setBatchStatus(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-bold text-amber-400 outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="Proses">Dalam Proses</option>
                  <option value="Ditindak">Sudah Ditindak</option>
                  <option value="Selesai">Selesai Dibina</option>
                </select>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={updateSanctionToo}
                    onChange={(e) => setUpdateSanctionToo(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-500 h-4 w-4"
                  />
                  <span>Perbarui Bentuk Sanksi / Takzir Massal</span>
                </label>

                {updateSanctionToo && (
                  <textarea
                    rows={2}
                    value={batchSanction}
                    onChange={(e) => setBatchSanction(e.target.value)}
                    placeholder="Tuliskan sanksi baru untuk semua santri yang dipilih..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-amber-500"
                  />
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBatchEditModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isBatchUpdating}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {isBatchUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 stroke-[3]" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL HAPUS MASSAL ================= */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white space-y-4 shadow-2xl animate-in zoom-in-95 relative z-[101]">
            <div className="flex items-center space-x-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/30">
                <Trash2 className="h-6 w-6 stroke-[2.3]" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Hapus {selectedIds.length} Catatan?</h3>
                <p className="text-xs text-slate-400">Data pelanggaran yang dipilih akan dihapus permanen</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
              Apakah Anda yakin ingin menghapus <strong>{selectedIds.length} catatan kedisiplinan</strong> sekaligus?
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(false)}
                disabled={isBatchDeleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                disabled={isBatchDeleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {isBatchDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>Ya, Hapus Semua</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL HAPUS SINGLE ================= */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900/95 p-6 text-white space-y-5 shadow-2xl animate-in zoom-in-95 duration-150 relative z-[101]">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/30 shadow-lg shadow-rose-500/10 animate-pulse">
                  <AlertTriangle className="h-6 w-6 stroke-[2.3]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white leading-tight">Hapus Catatan Disiplin?</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Data pelanggaran santri akan dihapus permanen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="text-slate-400 hover:text-white rounded-xl p-1 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Santri:</span>
                <span className="font-extrabold text-white text-sm">{itemToDelete.student_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">NIS:</span>
                <span className="font-mono font-bold text-cyan-400">{itemToDelete.nis}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                <span className="text-slate-400">Pelanggaran:</span>
                <span className="font-semibold text-rose-300 text-right max-w-[220px] truncate">
                  {itemToDelete.violation_name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-3 text-xs font-bold text-slate-300 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 inline-flex items-center justify-center space-x-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 py-3 text-xs font-black text-white shadow-lg shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>Ya, Hapus Data</span>
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
        title="Pemindai KTS Santri (Kedisiplinan)"
        description="Arahkan kamera ke QR Code KTS santri untuk melihat berkas disiplin"
      />
    </div>
  );
}
