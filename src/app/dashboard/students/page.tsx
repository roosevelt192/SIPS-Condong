"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { QRCodeSVG } from "qrcode.react";
import {
  GraduationCap,
  Plus,
  Search,
  Filter,
  QrCode,
  Edit,
  Trash2,
  Phone,
  FileSpreadsheet,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
  Download,
  CheckSquare,
  Square,
  UploadCloud,
  CheckCircle2,
  MapPin,
  BookOpen,
  Users,
  UserCheck,
  Activity,
  Compass,
  ImagePlus,
  FolderArchive,
  Images,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { generateStandardQRPayload } from "@/lib/qrParser";
import { playScanSound } from "@/lib/feedback";

interface Student {
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

type SortField = "name" | "nis" | "class" | "points" | "entry_year";
type SortOrder = "asc" | "desc";

export default function StudentsMasterPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Sorting State
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Multi-Select / Bulk Delete State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Single Delete State
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal States
  const [selectedStudentForKTS, setSelectedStudentForKTS] = useState<Student | null>(null);
  const [zoomedPhoto, setZoomedPhoto] = useState<{ url: string; name: string } | null>(null);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportScope, setExportScope] = useState<"all" | "active_only" | "current_filtered">("current_filtered");
  const [exportColumns] = useState({
    nis: true,
    nisn: true,
    name: true,
    gender: true,
    birth_info: true,
    class: true,
    dorm: true,
    entry_year: true,
    consulate: true,
    guardian_name: true,
    guardian_phone: true,
    address: true,
    points: true,
    status: true,
  });

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreviewCount, setImportPreviewCount] = useState<number | null>(null);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk Photo Modal State
  const [showBulkPhotoModal, setShowBulkPhotoModal] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkZipFile, setBulkZipFile] = useState<File | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, successCount: 0 });
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const bulkPhotoInputRef = useRef<HTMLInputElement>(null);
  const bulkZipInputRef = useRef<HTMLInputElement>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .range(0, 4999);

      if (error) throw error;

      if (data && data.length > 0) {
        const normalizedData: Student[] = data.map((item: any) => ({
          id: String(item.id),
          nis: item.nis || item.nomor_induk || "-",
          nisn: item.nisn || "-",
          name:
            item.full_name ||
            item.nama_lengkap ||
            item.nama_santri ||
            item.name ||
            item.nama ||
            "Tanpa Nama",
          gender:
            item.gender === "female" ||
            item.gender === "Perempuan" ||
            item.gender === "P" ||
            item.jenis_kelamin === "Perempuan" ||
            item.jenis_kelamin === "Banat (Perempuan / Putri)"
              ? "Perempuan"
              : "Laki-laki",
          pob: item.pob || item.tempat_lahir || item.birth_place || "-",
          dob: item.dob || item.tanggal_lahir || item.birth_date || "-",
          class: item.class || item.kelas || item.class_name || item.rombel || "-",
          dorm: item.dorm || item.kamar_asrama || item.asrama || item.rayon || item.kamar || "-",
          entry_year: String(item.entry_year || item.tahun_masuk || "2026"),
          consulate:
            item.consulate ||
            item.asal_konsulat ||
            item.konsulat ||
            item.kota_asal ||
            "Konsulat Tasikmalaya",
          guardian_name:
            item.guardian_name ||
            item.nama_lengkap_wali ||
            item.nama_wali ||
            item.parent_name ||
            "Wali Santri",
          guardian_phone:
            item.guardian_phone ||
            item.no_whatsapp ||
            item.no_telepon ||
            item.phone ||
            item.no_hp ||
            "-",
          address: item.address || item.alamat_lengkap || item.alamat || "-",
          photo_url:
            item.photo_url ||
            item.avatar_url ||
            item.foto ||
            item.image_url ||
            item.photo ||
            null,
          status:
            item.status === "inactive" ||
            item.status === "non-aktif" ||
            item.status_santri === "Non-Aktif"
              ? "inactive"
              : "active",
          points: item.points ?? item.poin_disiplin ?? item.poin ?? 100,
        }));

        setStudents(normalizedData);
      } else {
        setStudents([]);
      }
    } catch (err: any) {
      console.warn("Gagal memuat data santri:", err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const filteredStudents = useMemo(() => {
    const filtered = students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        s.name.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q) ||
        s.nisn.toLowerCase().includes(q) ||
        s.dorm.toLowerCase().includes(q) ||
        s.consulate.toLowerCase().includes(q) ||
        s.class.toLowerCase().includes(q);

      const matchesClass = filterClass === "all" || s.class === filterClass;
      const matchesStatus = filterStatus === "all" || s.status === filterStatus;

      return matchesSearch && matchesClass && matchesStatus;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name, "id");
      } else if (sortField === "nis") {
        comparison = a.nis.localeCompare(b.nis, undefined, { numeric: true });
      } else if (sortField === "class") {
        comparison = a.class.localeCompare(b.class, "id");
      } else if (sortField === "points") {
        comparison = a.points - b.points;
      } else if (sortField === "entry_year") {
        comparison = a.entry_year.localeCompare(b.entry_year);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [students, searchQuery, filterClass, filterStatus, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
  const paginatedStudents = useMemo(() => {
    return filteredStudents.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredStudents, currentPage, itemsPerPage]);

  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedStudents.length === 0) return false;
    return paginatedStudents.every((s) => selectedIds.includes(s.id));
  }, [paginatedStudents, selectedIds]);

  const handleToggleSelectCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      const currentPageIds = new Set(paginatedStudents.map((s) => s.id));
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...paginatedStudents.map((s) => s.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(filteredStudents.map((s) => s.id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleToggleStudentSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);

    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .in("id", selectedIds);

      if (error) throw error;

      playScanSound("success");
      setStudents((prev) => prev.filter((s) => !selectedIds.includes(s.id)));
      setSelectedIds([]);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      playScanSound("error");
      alert("Gagal menghapus data massal: " + err.message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", studentToDelete.id);

      if (error) throw error;

      playScanSound("success");
      setStudents((prev) => prev.filter((s) => s.id !== studentToDelete.id));
      setSelectedIds((prev) => prev.filter((id) => id !== studentToDelete.id));
      setStudentToDelete(null);
    } catch (err: any) {
      playScanSound("error");
      alert("Gagal menghapus santri: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.status === "active").length;
  const warningStudents = students.filter((s) => s.points < 80).length;

  const uniqueConsulates = useMemo(() => {
    const list = students.map((s) => s.consulate.trim()).filter((c) => c && c !== "-");
    return new Set(list).size;
  }, [students]);

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.class && s.class !== "-") set.add(s.class);
    });
    return Array.from(set).sort();
  }, [students]);

  const handleExecuteExport = async () => {
    setIsExporting(true);

    try {
      let dataToExport: Student[] = [];
      if (exportScope === "all") {
        dataToExport = students;
      } else if (exportScope === "active_only") {
        dataToExport = students.filter((s) => s.status === "active");
      } else {
        dataToExport = filteredStudents;
      }

      if (dataToExport.length === 0) {
        alert("Tidak ada data santri untuk diekspor!");
        setIsExporting(false);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "SIPS Pesantren Engine";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Master Data Santri", {
        views: [{ showGridLines: true }],
      });

      const dynamicColumns: { header: string; key: string; minWidth: number }[] = [
        { header: "NO", key: "no", minWidth: 6 },
      ];
      if (exportColumns.nis) dynamicColumns.push({ header: "NIS", key: "nis", minWidth: 14 });
      if (exportColumns.nisn) dynamicColumns.push({ header: "NISN", key: "nisn", minWidth: 14 });
      if (exportColumns.name) dynamicColumns.push({ header: "NAMA LENGKAP SANTRI", key: "name", minWidth: 28 });
      if (exportColumns.gender) dynamicColumns.push({ header: "JENIS KELAMIN", key: "gender", minWidth: 15 });
      if (exportColumns.birth_info) {
        dynamicColumns.push({ header: "TEMPAT LAHIR", key: "pob", minWidth: 18 });
        dynamicColumns.push({ header: "TANGGAL LAHIR", key: "dob", minWidth: 16 });
      }
      if (exportColumns.class) dynamicColumns.push({ header: "KELAS", key: "class", minWidth: 12 });
      if (exportColumns.dorm) dynamicColumns.push({ header: "KAMAR ASRAMA", key: "dorm", minWidth: 20 });
      if (exportColumns.entry_year) dynamicColumns.push({ header: "TAHUN MASUK", key: "entry_year", minWidth: 14 });
      if (exportColumns.consulate) dynamicColumns.push({ header: "ASAL KONSULAT", key: "consulate", minWidth: 22 });
      if (exportColumns.guardian_name) dynamicColumns.push({ header: "NAMA WALI", key: "guardian_name", minWidth: 24 });
      if (exportColumns.guardian_phone) dynamicColumns.push({ header: "NO. WHATSAPP WALI", key: "guardian_phone", minWidth: 20 });
      if (exportColumns.address) dynamicColumns.push({ header: "ALAMAT LENGKAP", key: "address", minWidth: 36 });
      if (exportColumns.points) dynamicColumns.push({ header: "POIN DISIPLIN", key: "points", minWidth: 14 });
      if (exportColumns.status) dynamicColumns.push({ header: "STATUS SANTRI", key: "status", minWidth: 14 });

      const lastColIndex = dynamicColumns.length;

      worksheet.mergeCells(1, 1, 1, lastColIndex);
      const titleCell = worksheet.getCell(1, 1);
      titleCell.value = "SISTEM INFORMASI & PENGASUHAN SANTRI (SIPS)";
      titleCell.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FF064E3B" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
      titleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

      worksheet.mergeCells(2, 1, 2, lastColIndex);
      const subTitleCell = worksheet.getCell(2, 1);
      subTitleCell.value = `Laporan Master Data Santri • Unduh: ${new Date().toLocaleDateString("id-ID", { dateStyle: "full" })} • Total: ${dataToExport.length} Santri`;
      subTitleCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF065F46" } };
      subTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
      subTitleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

      worksheet.getRow(1).height = 24;
      worksheet.getRow(2).height = 18;
      worksheet.addRow([]);

      worksheet.getRow(4).values = dynamicColumns.map((c) => c.header);
      const headerRow = worksheet.getRow(4);
      headerRow.height = 26;

      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
        cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      dataToExport.forEach((s, index) => {
        const rowData: any = { no: index + 1 };
        if (exportColumns.nis) rowData.nis = s.nis;
        if (exportColumns.nisn) rowData.nisn = s.nisn;
        if (exportColumns.name) rowData.name = s.name;
        if (exportColumns.gender) rowData.gender = s.gender;
        if (exportColumns.birth_info) {
          rowData.pob = s.pob;
          rowData.dob = s.dob;
        }
        if (exportColumns.class) rowData.class = s.class;
        if (exportColumns.dorm) rowData.dorm = s.dorm;
        if (exportColumns.entry_year) rowData.entry_year = s.entry_year;
        if (exportColumns.consulate) rowData.consulate = s.consulate;
        if (exportColumns.guardian_name) rowData.guardian_name = s.guardian_name;
        if (exportColumns.guardian_phone) rowData.guardian_phone = s.guardian_phone;
        if (exportColumns.address) rowData.address = s.address;
        if (exportColumns.points) rowData.points = `${s.points} Poin`;
        if (exportColumns.status) rowData.status = s.status === "active" ? "Aktif Mukim" : "Non-Aktif";

        const addedRow = worksheet.addRow(dynamicColumns.map((col) => rowData[col.key]));
        addedRow.height = 20;

        const isEven = index % 2 === 0;
        addedRow.eachCell((cell, colIndex) => {
          cell.font = { name: "Segoe UI", size: 9, color: { argb: "FF1E293B" } };
          cell.alignment = {
            vertical: "middle",
            horizontal: [1, 2, 4, 7, 9, 13, 14].includes(colIndex) ? "center" : "left",
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isEven ? "FFFFFFFF" : "FFF0FDF4" },
          };
        });
      });

      worksheet.columns = dynamicColumns.map((col) => {
        let maxLen = col.header.length;
        dataToExport.forEach((s) => {
          const val = String((s as any)[col.key] || "");
          if (val.length > maxLen) maxLen = val.length;
        });
        return { width: Math.max(maxLen + 4, col.minWidth) };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, `SIPS_Master_Santri_${new Date().toISOString().slice(0, 10)}.xlsx`);

      playScanSound("success");
      setShowExportModal(false);
    } catch (err: any) {
      playScanSound("error");
      alert("Gagal membuat file Excel: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "SIPS Pesantren Engine";

      const sheet1 = workbook.addWorksheet("Formulir Input Santri", {
        views: [{ showGridLines: true }],
      });

      sheet1.mergeCells("A1:M1");
      const titleCell = sheet1.getCell("A1");
      titleCell.value = "TEMPLATE IMPORT MASTER SANTRI - SIPS";
      titleCell.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FF064E3B" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
      titleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

      sheet1.mergeCells("A2:M2");
      const subTitleCell = sheet1.getCell("A2");
      subTitleCell.value = "Isi data mulai baris ke-4. Kolom (*) wajib diisi.";
      subTitleCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF065F46" } };
      subTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
      subTitleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

      sheet1.getRow(1).height = 24;
      sheet1.getRow(2).height = 18;

      const headers = [
        { header: "NIS *", key: "nis", width: 16 },
        { header: "NAMA LENGKAP *", key: "name", width: 30 },
        { header: "JENIS KELAMIN *", key: "gender", width: 16 },
        { header: "NISN", key: "nisn", width: 16 },
        { header: "TEMPAT LAHIR", key: "pob", width: 18 },
        { header: "TANGGAL LAHIR (YYYY-MM-DD)", key: "dob", width: 26 },
        { header: "KELAS *", key: "class", width: 14 },
        { header: "KAMAR ASRAMA", key: "dorm", width: 22 },
        { header: "TAHUN MASUK", key: "entry_year", width: 14 },
        { header: "ASAL KONSULAT", key: "consulate", width: 22 },
        { header: "NAMA WALI", key: "guardian_name", width: 24 },
        { header: "NO. WHATSAPP WALI", key: "guardian_phone", width: 20 },
        { header: "ALAMAT LENGKAP", key: "address", width: 38 },
      ];

      sheet1.getRow(3).values = headers.map((h) => h.header);
      const row3 = sheet1.getRow(3);
      row3.height = 26;
      row3.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
        cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      sheet1.columns = headers.map((h) => ({ width: h.width }));

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, "Template_Master_Santri_SIPS.xlsx");
      playScanSound("success");
    } catch (err: any) {
      playScanSound("error");
      alert("Gagal mengunduh template: " + err.message);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImportError("");
    setImportSuccess("");

    if (!file) {
      setImportFile(null);
      setImportPreviewCount(null);
      return;
    }

    setImportFile(file);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      setImportPreviewCount(Math.max(0, worksheet.rowCount - 3));
    } catch {
      setImportPreviewCount(1);
    }
  };

  const handleExecuteImport = async () => {
    if (!importFile) {
      setImportError("Pilih file Excel terlebih dahulu.");
      return;
    }

    setIsImporting(true);
    setImportError("");
    setImportSuccess("");

    try {
      const { data: sampleData } = await supabase
        .from("students")
        .select("*")
        .limit(1);

      const existingCols = sampleData && sampleData[0] ? Object.keys(sampleData[0]) : [];

      const buffer = await importFile.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      const parsedStudents: any[] = [];

      let headerRowIndex = 3;
      for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
        const row = worksheet.getRow(r);
        const rowText = JSON.stringify(row.values || []).toLowerCase();
        if (
          rowText.includes("nis") ||
          rowText.includes("nama") ||
          rowText.includes("name")
        ) {
          headerRowIndex = r;
          break;
        }
      }

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > headerRowIndex) {
          const values = row.values as any[];
          if (!values || values.length <= 1) return;

          const getVal = (idx: number) => {
            const raw = values[idx];
            if (raw === null || raw === undefined) return "";
            if (typeof raw === "object") {
              if (raw.text) return String(raw.text).trim();
              if (raw.result) return String(raw.result).trim();
              return "";
            }
            return String(raw).trim();
          };

          const rawNis = getVal(1);
          const nis = rawNis && rawNis !== "-" ? rawNis : `NIS-${Date.now()}-${rowNumber}`;
          const name = getVal(2);
          const rawGender = getVal(3) || "Laki-laki";
          const isFemale =
            rawGender.toLowerCase().includes("perempuan") ||
            rawGender.toLowerCase().includes("banat") ||
            rawGender.toLowerCase().includes("putri") ||
            rawGender.toLowerCase() === "p" ||
            rawGender.toLowerCase() === "female";
          const genderText = isFemale ? "Perempuan" : "Laki-laki";

          const rawNisn = getVal(4);
          const nisn = rawNisn && rawNisn !== "-" && rawNisn !== "undefined" && rawNisn !== "" ? rawNisn : null;

          const pob = getVal(5) || "-";
          const dob = getVal(6) || "-";
          const studentClass = getVal(7) || "1 KMI";
          const dorm = getVal(8) || "-";
          const entry_year = getVal(9) || "2026";
          const consulate = getVal(10) || "Konsulat Tasikmalaya";
          const guardian_name = getVal(11) || "Wali Santri";
          const guardian_phone = getVal(12) || "-";
          const address = getVal(13) || "-";

          if (name && name !== "undefined" && name !== "") {
            const studentPayload: any = {};

            const assignMatchingColumns = (columnCandidates: string[], val: any) => {
              if (existingCols.length > 0) {
                columnCandidates.forEach((col) => {
                  if (existingCols.includes(col)) {
                    studentPayload[col] = val;
                  }
                });
              } else {
                studentPayload[columnCandidates[0]] = val;
              }
            };

            assignMatchingColumns(["full_name", "nama_lengkap", "name", "nama_santri", "nama"], name);
            assignMatchingColumns(["nis", "nomor_induk"], nis);
            assignMatchingColumns(["nisn"], nisn);
            assignMatchingColumns(["gender", "jenis_kelamin", "sex"], genderText);
            assignMatchingColumns(["pob", "tempat_lahir", "birth_place"], pob);
            assignMatchingColumns(["dob", "tanggal_lahir", "birth_date"], dob);
            assignMatchingColumns(["class", "kelas", "class_name", "rombel", "tingkat"], studentClass);
            assignMatchingColumns(["dorm", "kamar_asrama", "asrama", "rayon", "kamar"], dorm);
            assignMatchingColumns(["entry_year", "tahun_masuk"], entry_year);
            assignMatchingColumns(["consulate", "asal_konsulat", "konsulat", "kota_asal"], consulate);
            assignMatchingColumns(["guardian_name", "nama_lengkap_wali", "nama_wali", "parent_name"], guardian_name);
            assignMatchingColumns(["guardian_phone", "no_whatsapp", "no_telepon", "no_hp", "phone"], guardian_phone);
            assignMatchingColumns(["address", "alamat_lengkap", "alamat"], address);
            assignMatchingColumns(["status", "status_santri"], "active");
            assignMatchingColumns(["points", "poin_disiplin", "poin", "point"], 100);

            parsedStudents.push(studentPayload);
          }
        }
      });

      if (parsedStudents.length === 0) {
        throw new Error("Tidak ada baris data santri yang valid dalam file Excel.");
      }

      const BATCH_SIZE = 100;
      let insertedCount = 0;

      for (let i = 0; i < parsedStudents.length; i += BATCH_SIZE) {
        const chunk = parsedStudents.slice(i, i + BATCH_SIZE);
        const conflictCol = existingCols.includes("nis") ? "nis" : undefined;
        let insertError = null;

        if (conflictCol) {
          const { error } = await supabase
            .from("students")
            .upsert(chunk, { onConflict: conflictCol });
          insertError = error;
        } else {
          const { error } = await supabase.from("students").insert(chunk);
          insertError = error;
        }

        if (insertError) {
          const { error: fallbackErr } = await supabase.from("students").insert(chunk);
          if (fallbackErr) throw fallbackErr;
        }

        insertedCount += chunk.length;
      }

      playScanSound("success");
      setImportSuccess(`Berhasil mengimpor seluruh ${insertedCount} data santri ke database SIPS!`);
      await fetchStudents();

      setTimeout(() => {
        setShowImportModal(false);
        setImportFile(null);
        setImportPreviewCount(null);
        setImportSuccess("");
      }, 1500);
    } catch (err: any) {
      playScanSound("error");
      setImportError(err.message || "Gagal memproses file Excel.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleBulkFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setBulkError("");
    setBulkSuccess("");
    setBulkZipFile(null);
    setBulkFiles(files.filter((f) => f.type.startsWith("image/")));
  };

  const handleBulkZipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setBulkError("");
    setBulkSuccess("");
    setBulkFiles([]);

    if (file && (file.name.endsWith(".zip") || file.type.includes("zip"))) {
      setBulkZipFile(file);
    } else {
      setBulkError("Harap pilih file arsip kompresi berekstensi .ZIP");
      setBulkZipFile(null);
    }
  };

  const handleExecuteBulkPhotoUpload = async () => {
    if (bulkFiles.length === 0 && !bulkZipFile) {
      setBulkError("Pilih kumpulan foto atau file .ZIP terlebih dahulu.");
      return;
    }

    setIsBulkUploading(true);
    setBulkError("");
    setBulkSuccess("");

    try {
      const imageItems: { nis: string; fileBlob: Blob; ext: string }[] = [];

      if (bulkZipFile) {
        const zip = new JSZip();
        const unzipped = await zip.loadAsync(bulkZipFile);

        const fileNames = Object.keys(unzipped.files);
        for (const fileName of fileNames) {
          const zipEntry = unzipped.files[fileName];
          if (zipEntry.dir || fileName.startsWith("__MACOSX")) continue;

          const ext = fileName.split(".").pop()?.toLowerCase() || "";
          if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
            const rawName = fileName.split("/").pop() || fileName;
            const nis = rawName.substring(0, rawName.lastIndexOf(".")).trim();
            const blob = await zipEntry.async("blob");
            imageItems.push({ nis, fileBlob: blob, ext });
          }
        }
      } else {
        bulkFiles.forEach((f) => {
          const rawName = f.name;
          const ext = rawName.split(".").pop()?.toLowerCase() || "jpg";
          const nis = rawName.substring(0, rawName.lastIndexOf(".")).trim();
          imageItems.push({ nis, fileBlob: f, ext });
        });
      }

      if (imageItems.length === 0) {
        throw new Error("Tidak ditemukan file foto yang valid (JPG/PNG).");
      }

      setBulkProgress({ current: 0, total: imageItems.length, successCount: 0 });
      let matchSuccessCount = 0;

      for (let i = 0; i < imageItems.length; i++) {
        const item = imageItems[i];
        setBulkProgress((prev) => ({ ...prev, current: i + 1 }));

        try {
          const filePath = `avatars/${item.nis}_${Date.now()}.${item.ext}`;

          const { error: uploadErr } = await supabase.storage
            .from("student-photos")
            .upload(filePath, item.fileBlob, { upsert: true });

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage
              .from("student-photos")
              .getPublicUrl(filePath);

            const publicUrl = publicUrlData.publicUrl;

            const { error: updateErr } = await supabase
              .from("students")
              .update({ photo_url: publicUrl })
              .eq("nis", item.nis);

            if (!updateErr) {
              matchSuccessCount++;
            }
          }
        } catch (e) {
          console.warn(`Gagal memproses foto untuk NIS ${item.nis}:`, e);
        }
      }

      setBulkProgress((prev) => ({ ...prev, successCount: matchSuccessCount }));
      playScanSound("success");
      setBulkSuccess(`Berhasil mengunggah & mencocokkan ${matchSuccessCount} pas foto santri berdasarkan NIS!`);
      await fetchStudents();

      setTimeout(() => {
        setShowBulkPhotoModal(false);
        setBulkFiles([]);
        setBulkZipFile(null);
        setBulkSuccess("");
      }, 1800);
    } catch (err: any) {
      playScanSound("error");
      setBulkError(err.message || "Gagal memproses upload foto massal.");
    } finally {
      setIsBulkUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans relative pb-20">
      {/* Glow Hiasan */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-40 -left-10 h-72 w-72 rounded-full bg-teal-500/10 blur-[100px]" />

      {/* Header Section */}
      <div className="relative overflow-hidden rounded-[32px] border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5 min-w-0">
            <Link
              href="/dashboard"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-500/40 transition active:scale-95 shadow-xs"
              title="Kembali ke Dashboard Utama"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
            </Link>

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-600 to-amber-500 text-white shadow-md shadow-emerald-700/20 font-black">
              <GraduationCap className="h-6 w-6 stroke-[2.3]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white truncate">
                  Database Master Santri
                </h1>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Data Induk
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Pusat data induk terpadu santri, identitas digital KTS, asrama, konsulat, dan kedisiplinan
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <button
              type="button"
              onClick={fetchStudents}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-sm transition hover:border-emerald-500/50 hover:text-emerald-600 active:scale-95 cursor-pointer"
              title="Segarkan Data"
            >
              <RefreshCw
                className={`h-4 w-4 transition-transform duration-500 ${
                  loading ? "animate-spin text-emerald-600" : ""
                }`}
              />
            </button>

            <div className="inline-flex items-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-950/70 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center space-x-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition hover:bg-white dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95 cursor-pointer"
              >
                <UploadCloud className="h-3.5 w-3.5 text-emerald-600" />
                <span className="whitespace-nowrap">Import Excel</span>
              </button>

              <span className="h-3.5 w-px bg-slate-300 dark:bg-slate-800 mx-0.5" />

              <button
                type="button"
                onClick={() => setShowBulkPhotoModal(true)}
                className="inline-flex items-center space-x-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition hover:bg-white dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95 cursor-pointer"
              >
                <ImagePlus className="h-3.5 w-3.5 text-emerald-600" />
                <span className="whitespace-nowrap">Upload Foto Massal</span>
              </button>

              <span className="h-3.5 w-px bg-slate-300 dark:bg-slate-800 mx-0.5" />

              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                className="inline-flex items-center space-x-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition hover:bg-white dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95 cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span className="whitespace-nowrap">Eksport Data</span>
              </button>
            </div>

            <Link
              href="/dashboard/students/new"
              className="inline-flex items-center space-x-1.5 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-700/20 transition active:scale-95 shrink-0"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span className="whitespace-nowrap">Tambah Santri</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-5 shadow-xs backdrop-blur-md transition hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Santri</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            {totalStudents}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span className="text-emerald-600 font-bold">100%</span> tercatat di sistem
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-5 shadow-xs backdrop-blur-md transition hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Santri Aktif</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            {activeStudents}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Berstatus mukim aktif</span>
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-5 shadow-xs backdrop-blur-md transition hover:border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Poin &lt; 80</span>
            <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-2 font-mono">
            {warningStudents}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">Perlu perhatian pengasuhan</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-5 shadow-xs backdrop-blur-md transition hover:border-purple-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Konsulat</span>
            <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Compass className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            {uniqueConsulates}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">Wilayah asal konsulat</p>
        </div>
      </div>

      {/* Toolbar: Search, Filter, & Sorting */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-4 shadow-sm backdrop-blur-md">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari nama santri, NIS, NISN, konsulat, asrama..."
            className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3 py-1.5 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500">Urut:</span>
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [f, o] = e.target.value.split("-") as [SortField, SortOrder];
                setSortField(f);
                setSortOrder(o);
                setCurrentPage(1);
              }}
              className="bg-transparent font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer text-xs"
            >
              <option value="name-asc">Nama (A - Z)</option>
              <option value="name-desc">Nama (Z - A)</option>
              <option value="nis-asc">NIS (Terkecil)</option>
              <option value="nis-desc">NIS (Terbesar)</option>
              <option value="class-asc">Kelas</option>
              <option value="points-desc">Poin (Tertinggi)</option>
              <option value="points-asc">Poin (Terendah)</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 pl-1">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={filterClass}
            onChange={(e) => {
              setFilterClass(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none transition focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Semua Kelas</option>
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none transition focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Non-Aktif</option>
          </select>
        </div>
      </div>

      {/* DATA CONTAINER: CARD VIEW PADA HP (MD KE BAWAH) & TABEL ELEGAN PADA DESKTOP */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 shadow-xl shadow-slate-200/30 dark:shadow-black/40 backdrop-blur-xl relative">
        
        {/* TAMPILAN 1: MOBILE CARD LIST (Tampil hanya di layar HP < md) */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
          <div className="p-4 bg-slate-50/90 dark:bg-slate-950/60 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleToggleSelectCurrentPage}
              className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              {isAllCurrentPageSelected ? (
                <CheckSquare className="h-4 w-4 text-emerald-600" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              <span>Pilih Semua di Halaman Ini</span>
            </button>
            <span className="text-[11px] font-mono text-slate-400">
              Hal. {currentPage} / {totalPages}
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="mx-auto h-7 w-7 animate-spin text-emerald-600 mb-2" />
              <span className="text-xs font-semibold">Sinkronisasi Database Santri...</span>
            </div>
          ) : paginatedStudents.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs px-4">
              Tidak ada data santri yang cocok dengan kriteria pencarian.
            </div>
          ) : (
            paginatedStudents.map((s) => {
              const isChecked = selectedIds.includes(s.id);
              return (
                <div
                  key={s.id}
                  className={`p-4 transition-colors ${
                    isChecked
                      ? "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.08]"
                      : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox & Avatar */}
                    <div className="flex flex-col items-center gap-2.5 pt-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleStudentSelect(s.id)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                      />
                      <div
                        onClick={() => s.photo_url && setZoomedPhoto({ url: s.photo_url, name: s.name })}
                        className={`w-12 h-15 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-gradient-to-tr from-emerald-800 via-teal-700 to-amber-600 shadow-sm flex items-center justify-center shrink-0 ${
                          s.photo_url ? "cursor-pointer active:scale-95 transition-transform" : ""
                        }`}
                      >
                        {s.photo_url ? (
                          <img
                            src={s.photo_url}
                            alt={s.name}
                            className="h-full w-full object-cover object-top"
                          />
                        ) : (
                          <span className="font-black text-white text-base">
                            {s.name.charAt(0)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Santri Details */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">
                          {s.name}
                        </h4>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-black shrink-0 ${
                            s.points >= 90
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                              : s.points >= 75
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {s.points} Poin
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                          NIS: {s.nis}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {s.gender}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold text-[11px]">
                          {s.class}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {s.dorm}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{s.consulate}</span>
                      </div>

                      {/* Wali & WhatsApp Link */}
                      <div className="pt-1 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 text-xs">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                          Wali: {s.guardian_name}
                        </span>
                        {s.guardian_phone !== "-" ? (
                          <a
                            href={`https://wa.me/${s.guardian_phone.replace(/^0/, "62")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <Phone className="h-3 w-3" />
                            <span>{s.guardian_phone}</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">-</span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center justify-end gap-1 border-t border-slate-100 dark:border-slate-800/60">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForKTS(s)}
                          className="inline-flex items-center space-x-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2.5 py-1 text-xs font-bold active:scale-95"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          <span>KTS</span>
                        </button>

                        <Link
                          href={`/dashboard/students/${s.id}/edit`}
                          className="inline-flex items-center space-x-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1 text-xs font-bold active:scale-95"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => setStudentToDelete(s)}
                          className="p-1.5 text-rose-500 rounded-xl hover:bg-rose-500/10 active:scale-95"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* TAMPILAN 2: DESKTOP TABLE VIEW (Tampil di tablet/desktop md ke atas) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-950/60 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                <th className="py-4 px-4 text-center w-12">
                  <button
                    type="button"
                    onClick={handleToggleSelectCurrentPage}
                    className="text-slate-400 hover:text-emerald-600 transition cursor-pointer"
                    title={isAllCurrentPageSelected ? "Batalkan halaman ini" : "Pilih semua di halaman ini"}
                  >
                    {isAllCurrentPageSelected ? (
                      <CheckSquare className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>

                <th className="py-4 px-2 font-bold text-center w-16">Foto</th>

                <th
                  onClick={() => handleSort("name")}
                  className="py-4 px-4 font-bold cursor-pointer hover:text-emerald-600 transition"
                >
                  <div className="flex items-center space-x-1">
                    <span>Identitas &amp; NIS</span>
                    {sortField === "name" && (
                      sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                </th>

                <th
                  onClick={() => handleSort("class")}
                  className="py-4 px-4 font-bold cursor-pointer hover:text-emerald-600 transition"
                >
                  <div className="flex items-center space-x-1">
                    <span>Kelas &amp; Asrama</span>
                    {sortField === "class" && (
                      sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                </th>

                <th className="py-4 px-4 font-bold">Kontak Wali</th>

                <th
                  onClick={() => handleSort("points")}
                  className="py-4 px-4 text-center font-bold cursor-pointer hover:text-emerald-600 transition"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Poin Disiplin</span>
                    {sortField === "points" && (
                      sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                </th>

                <th className="py-4 px-4 text-center font-bold">Status</th>
                <th className="py-4 px-4 text-center font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-7 w-7 animate-spin text-emerald-600 mb-2" />
                    <span className="text-xs font-semibold">Sinkronisasi Database Santri SIPS...</span>
                  </td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 text-xs">
                    Tidak ada data santri yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s) => {
                  const isChecked = selectedIds.includes(s.id);
                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors group ${
                        isChecked
                          ? "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.08]"
                          : "hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.02]"
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleStudentSelect(s.id)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-2 text-center">
                        <div className="relative inline-block group/avatar">
                          <div
                            onClick={() => s.photo_url && setZoomedPhoto({ url: s.photo_url, name: s.name })}
                            className={`w-11 h-14 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-gradient-to-tr from-emerald-800 via-teal-700 to-amber-600 shadow-sm flex items-center justify-center ${
                              s.photo_url ? "cursor-pointer hover:ring-2 hover:ring-emerald-500 hover:shadow-md transition-all" : ""
                            }`}
                          >
                            {s.photo_url ? (
                              <img
                                src={s.photo_url}
                                alt={s.name}
                                className="h-full w-full object-cover object-top group-hover/avatar:scale-105 transition duration-300"
                              />
                            ) : (
                              <span className="font-black text-white text-base">
                                {s.name.charAt(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="min-w-0">
                          <p className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {s.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              NIS: {s.nis}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {s.gender}
                            </span>
                          </div>
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                            <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                            <span className="truncate">{s.consulate}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-block rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 px-2.5 py-0.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                          {s.class}
                        </span>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-semibold">
                          {s.dorm}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Angkatan {s.entry_year}
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          {s.guardian_name}
                        </p>
                        {s.guardian_phone !== "-" ? (
                          <a
                            href={`https://wa.me/${s.guardian_phone.replace(/^0/, "62")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline mt-1"
                          >
                            <Phone className="h-3 w-3" />
                            <span>{s.guardian_phone}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-black font-mono shadow-sm ${
                            s.points >= 90
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                              : s.points >= 75
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {s.points} Poin
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center space-x-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                            s.status === "active"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-700/40"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              s.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                            }`}
                          />
                          <span>{s.status === "active" ? "Aktif Mukim" : "Non-Aktif"}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentForKTS(s)}
                            className="rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-600 transition active:scale-90 cursor-pointer"
                            title="Cetak KTS Digital"
                          >
                            <QrCode className="h-4 w-4" />
                          </button>

                          <Link
                            href={`/dashboard/students/${s.id}/edit`}
                            className="rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition active:scale-90"
                            title="Edit Data"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => setStudentToDelete(s)}
                            className="rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition active:scale-90 cursor-pointer"
                            title="Hapus Data"
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

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800/80 px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/40">
          <span>
            Menampilkan{" "}
            <strong className="text-slate-900 dark:text-white font-mono">
              {filteredStudents.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
            </strong>{" "}
            -{" "}
            <strong className="text-slate-900 dark:text-white font-mono">
              {Math.min(currentPage * itemsPerPage, filteredStudents.length)}
            </strong>{" "}
            dari{" "}
            <strong className="text-slate-900 dark:text-white font-mono">
              {filteredStudents.length}
            </strong>{" "}
            santri
          </span>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-1.5 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="px-2 font-bold font-mono text-slate-900 dark:text-white">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-1.5 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* FLOATING ACTION BAR FOR BULK ACTIONS */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-slate-900/95 text-white px-5 py-3 rounded-2xl border border-emerald-500/40 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200 max-w-[90vw] overflow-x-auto">
          <div className="flex items-center space-x-2 text-xs font-bold shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{selectedIds.length} Santri Terpilih</span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-1 shrink-0" />

          <button
            type="button"
            onClick={handleSelectAllFiltered}
            className="text-xs text-emerald-400 hover:underline font-semibold cursor-pointer shrink-0"
          >
            Pilih Semua ({filteredStudents.length})
          </button>

          <button
            type="button"
            onClick={handleClearSelection}
            className="text-xs text-slate-400 hover:text-white font-medium cursor-pointer shrink-0"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={() => setShowBulkDeleteModal(true)}
            className="inline-flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-500 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-md shadow-rose-600/30 transition active:scale-95 cursor-pointer shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Hapus Massal</span>
          </button>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS BANYAK SANTRI */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl text-white space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-lg shadow-rose-500/10">
                  <AlertTriangle className="h-6 w-6 stroke-[2.3]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Hapus {selectedIds.length} Data Santri?
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Seluruh santri yang dicentang akan dihapus permanen dari sistem
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="text-slate-400 hover:text-white rounded-xl p-1 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4 text-xs text-rose-300">
              ⚠️ Perhatian: Tindakan ini akan menghapus riwayat izin, poin pelanggaran, serta arsip profil dari <strong>{selectedIds.length} santri terpilih</strong>. Tindakan ini tidak dapat dibatalkan.
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isBulkDeleting}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-2.5 text-xs font-bold text-slate-300 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={isBulkDeleting}
                className="flex-1 inline-flex items-center justify-center space-x-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isBulkDeleting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Menghapus {selectedIds.length} Data...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Ya, Hapus {selectedIds.length} Santri</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hapus Satuan */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl text-white space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-lg shadow-rose-500/10">
                  <AlertTriangle className="h-6 w-6 stroke-[2.3]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Hapus Data Santri?
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tindakan ini permanen dan tidak dapat dibatalkan
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="text-slate-400 hover:text-white rounded-xl p-1 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Nama Santri:</span>
                <span className="font-bold text-white">{studentToDelete.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">NIS:</span>
                <span className="font-mono font-semibold text-emerald-400">{studentToDelete.nis}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Kelas / Asrama:</span>
                <span className="font-medium text-slate-300">
                  {studentToDelete.class} • {studentToDelete.dorm}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-2.5 text-xs font-bold text-slate-300 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 inline-flex items-center justify-center space-x-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Ya, Hapus Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Zoom Foto */}
      {zoomedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative max-w-sm w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl p-4 text-center space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white truncate">{zoomedPhoto.name}</span>
              <button
                type="button"
                onClick={() => setZoomedPhoto(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-72 w-full rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center">
              <img src={zoomedPhoto.url} alt={zoomedPhoto.name} className="h-full w-full object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Modal Import Excel */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl text-white space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <UploadCloud className="h-6 w-6 stroke-[2.3]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Impor Data Santri Massal (.xlsx)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mendukung ratusan data santri sekaligus dengan batching aman
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportError("");
                  setImportSuccess("");
                }}
                className="text-slate-400 hover:text-white rounded-xl p-1 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs">
              <div className="flex items-center space-x-2.5">
                <BookOpen className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold text-slate-200">Template Resmi SIPS (.xlsx)</p>
                  <p className="text-[11px] text-slate-400">Format 100% selaras dengan form input santri</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh Template</span>
              </button>
            </div>

            {importError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs font-semibold text-rose-300 animate-in fade-in">
                ⚠️ {importError}
              </div>
            )}
            {importSuccess && (
              <div className="flex items-center space-x-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs font-semibold text-emerald-300 animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{importSuccess}</span>
              </div>
            )}

            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/40 hover:bg-slate-950/80 p-6 text-center cursor-pointer transition"
              >
                <UploadCloud className="h-8 w-8 text-emerald-400 mb-2" />
                <p className="text-xs font-bold text-white">
                  {importFile ? importFile.name : "Klik atau seret file .xlsx / .csv ke sini"}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {importFile
                    ? `Ukuran: ${(importFile.size / 1024).toFixed(1)} KB • Siap diproses (${importPreviewCount} baris)`
                    : "Membaca kolom NIS, Nama, Kelas, Asrama, dsb."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                disabled={isImporting}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-2.5 text-xs font-bold text-slate-300 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isImporting || !importFile}
                className="flex-1 inline-flex items-center justify-center space-x-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-700/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Mengimpor ke Supabase...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Mulai Impor Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Export Excel */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl text-white space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <FileSpreadsheet className="h-6 w-6 stroke-[2.3]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Eksport Data Santri SIPS (.xlsx)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sesuaikan kolom &amp; cakupan data yang ingin diunduh
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white rounded-xl p-1 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">1. Cakupan Data</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: "current_filtered", label: "Hasil Filter", desc: `${filteredStudents.length} Santri` },
                  { id: "all", label: "Semua Data", desc: `${students.length} Santri` },
                  { id: "active_only", label: "Santri Aktif", desc: `${students.filter((s) => s.status === "active").length} Santri` },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setExportScope(item.id as any)}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      exportScope === item.id
                        ? "border-emerald-500/50 bg-emerald-500/10 text-white shadow-sm"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <p className="text-xs font-bold">{item.label}</p>
                    <p className="text-[10px] text-emerald-400 font-mono mt-0.5">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-2.5 text-xs font-bold text-slate-300 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleExecuteExport}
                disabled={isExporting}
                className="flex-1 inline-flex items-center justify-center space-x-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-700/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Menyiapkan File...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Unduh File Excel</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal KTS Landscape */}
      {selectedStudentForKTS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-[680px] overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900 shadow-2xl text-white space-y-4 animate-in zoom-in-95 duration-150 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center space-x-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-extrabold tracking-wider text-emerald-400 text-xs sm:text-sm uppercase">
                  Pratinjau KTS Digital
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForKTS(null)}
                className="text-slate-400 hover:text-white rounded-xl p-1.5 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-[#064e3b] via-[#043327] to-slate-950 p-6 sm:p-7 shadow-2xl">
              <div className="relative z-10 flex items-center justify-between border-b border-emerald-800/80 pb-4 mb-5">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-200 text-[#064e3b] shadow-md font-black">
                    <GraduationCap className="h-5 w-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h5 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white leading-none">
                      PONDOK PESANTREN CONDONG
                    </h5>
                    <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-300 mt-1">
                      KARTU TANDA SANTRI DIGITAL TERPADU
                    </p>
                  </div>
                </div>

                <span className="rounded-xl bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-400/40">
                  Aktif Mukim
                </span>
              </div>

              <div className="relative z-10 flex items-center gap-6">
                <div className="w-24 h-32 rounded-2xl overflow-hidden border-2 border-emerald-400/50 bg-slate-950 shadow-xl flex items-center justify-center shrink-0">
                  {selectedStudentForKTS.photo_url ? (
                    <img
                      src={selectedStudentForKTS.photo_url}
                      alt={selectedStudentForKTS.name}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <span className="font-black text-white text-3xl">
                      {selectedStudentForKTS.name.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/70 block">
                      Nama Lengkap Santri
                    </span>
                    <h4 className="font-black text-base sm:text-lg text-white leading-tight truncate">
                      {selectedStudentForKTS.name}
                    </h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs sm:text-sm font-black text-emerald-300 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                      NIS: {selectedStudentForKTS.nis}
                    </span>
                    <span className="text-xs text-slate-300 font-medium">
                      {selectedStudentForKTS.gender} • Masuk {selectedStudentForKTS.entry_year}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-center justify-center p-3 rounded-2xl bg-white text-slate-950 shadow-xl border border-slate-200">
                  <QRCodeSVG
                    value={generateStandardQRPayload({
                      nis: selectedStudentForKTS.nis,
                      id: selectedStudentForKTS.id,
                    })}
                    size={104}
                    level="M"
                    includeMargin={false}
                  />
                  <span className="font-mono text-[9px] font-black tracking-wider mt-2 text-[#064e3b] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    SIPS-{selectedStudentForKTS.nis}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 inline-flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-700/20 transition active:scale-95 cursor-pointer"
              >
                <QrCode className="h-4 w-4" />
                <span>Cetak KTS Digital</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedStudentForKTS(null)}
                className="rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-800 px-5 py-3 text-xs sm:text-sm font-bold text-slate-300 transition active:scale-95 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Upload Foto Massal */}
      {showBulkPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl text-white space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <ImagePlus className="h-6 w-6 stroke-[2.3]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Upload Pas Foto Massal
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cocokkan foto otomatis dengan santri menggunakan nama file <strong>[NIS].jpg</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowBulkPhotoModal(false);
                  setBulkFiles([]);
                  setBulkZipFile(null);
                  setBulkError("");
                  setBulkSuccess("");
                }}
                className="text-slate-400 hover:text-white rounded-xl p-1 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {bulkError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs font-semibold text-rose-300 animate-in fade-in">
                ⚠️ {bulkError}
              </div>
            )}
            {bulkSuccess && (
              <div className="flex items-center space-x-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs font-semibold text-emerald-300 animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{bulkSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="file"
                ref={bulkPhotoInputRef}
                multiple
                accept="image/png, image/jpeg, image/webp"
                onChange={handleBulkFilesSelect}
                className="hidden"
              />
              <input
                type="file"
                ref={bulkZipInputRef}
                accept=".zip, application/zip"
                onChange={handleBulkZipSelect}
                className="hidden"
              />

              <div
                onClick={() => bulkPhotoInputRef.current?.click()}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed cursor-pointer transition text-center ${
                  bulkFiles.length > 0
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-950/40 hover:border-slate-500 hover:bg-slate-950/70"
                }`}
              >
                <Images className="h-6 w-6 text-emerald-400 mb-1.5" />
                <p className="text-xs font-bold text-white">Pilih Banyak Foto</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {bulkFiles.length > 0 ? `${bulkFiles.length} foto dipilih` : "Multi-select .jpg / .png"}
                </p>
              </div>

              <div
                onClick={() => bulkZipInputRef.current?.click()}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed cursor-pointer transition text-center ${
                  bulkZipFile
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-950/40 hover:border-slate-500 hover:bg-slate-950/70"
                }`}
              >
                <FolderArchive className="h-6 w-6 text-teal-400 mb-1.5" />
                <p className="text-xs font-bold text-white">Unggah File .ZIP</p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[170px]">
                  {bulkZipFile ? bulkZipFile.name : "1 file ZIP berisi pas foto"}
                </p>
              </div>
            </div>

            {isBulkUploading && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
                  <span>Memproses sinkronisasi foto...</span>
                  <span className="font-bold text-emerald-400">
                    {bulkProgress.current} / {bulkProgress.total} Foto
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                    style={{
                      width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowBulkPhotoModal(false)}
                disabled={isBulkUploading}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-2.5 text-xs font-bold text-slate-300 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleExecuteBulkPhotoUpload}
                disabled={isBulkUploading || (bulkFiles.length === 0 && !bulkZipFile)}
                className="flex-1 inline-flex items-center justify-center space-x-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-700/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isBulkUploading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Mengunggah...</span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Mulai Sinkronisasi Foto</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}