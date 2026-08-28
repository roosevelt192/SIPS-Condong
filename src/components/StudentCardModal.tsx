"use client";

import QRCode from "react-qr-code";

export type Student = {
  id: string;
  nis: string;
  nisn?: string | null;
  nik?: string | null;
  full_name: string;
  gender?: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  class_name?: string | null;
  room?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  address?: string | null;
  entry_year?: number | null;
  status?: string | null;
  photo_url?: string | null;
  created_at?: string;
};

type StudentCardModalProps = {
  students: Student[];
  onClose: () => void;
};

export default function StudentCardModal({ students, onClose }: StudentCardModalProps) {
  // Fungsi cetak kartu
  function handlePrint() {
    window.print();
  }

  if (students.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-150 font-sans">
      
      {/* CSS Khusus Print A4 */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-4xl rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        
        {/* HEADER MODAL */}
        <div className="no-print flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Cetak Kartu Tanda Santri (KTS)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan <span className="font-bold text-emerald-700">{students.length} kartu</span> siap cetak berukuran standar ID Card.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Cetak / Simpan PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition active:scale-95"
              title="Tutup Modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* AREA KARTU (GRID CETAK) */}
        <div id="print-area" className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
          {students.map((student) => {
            const isMale = (student.gender ?? "L").toUpperCase() === "L";
            const qrPayload = JSON.stringify({
              nis: student.nis,
              name: student.full_name,
              cls: student.class_name || "-",
              rm: student.room || "-",
            });

            return (
              <div
                key={student.id}
                className="relative overflow-hidden rounded-2xl border-2 border-slate-800 bg-white shadow-md flex flex-col justify-between"
                style={{ width: "100%", maxWidth: "380px", minHeight: "230px", margin: "0 auto" }}
              >
                {/* HEADER KARTU */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 p-3 text-white flex items-center justify-between border-b-2 border-emerald-500">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 font-black text-xs">
                      S
                    </div>
                    <div>
                      <h3 className="text-xs font-black tracking-wider uppercase leading-none">
                        SAPA PESANTREN
                      </h3>
                      <p className="text-[9px] text-emerald-300 font-medium mt-0.5">
                        Kartu Tanda Santri (KTS)
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 text-[8px] font-black uppercase text-emerald-300">
                    {student.status || "Aktif"}
                  </span>
                </div>

                {/* BADAN KARTU */}
                <div className="p-3.5 flex items-center gap-3.5 flex-1 bg-gradient-to-b from-white to-slate-50">
                  {/* Foto / Inisial */}
                  <div
                    className={`flex h-20 w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl text-lg font-black text-white shadow-sm border border-slate-300 ${
                      student.photo_url
                        ? "bg-slate-100"
                        : isMale
                        ? "bg-gradient-to-br from-sky-600 to-indigo-700"
                        : "bg-gradient-to-br from-rose-500 to-pink-600"
                    }`}
                  >
                    {student.photo_url ? (
                      <img
                        src={student.photo_url}
                        alt={student.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        <span>{student.full_name ? student.full_name.charAt(0).toUpperCase() : "S"}</span>
                        <span className="text-[8px] font-bold opacity-80 mt-1">
                          {isMale ? "BANIN" : "BANAT"}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Informasi Santri */}
                  <div className="flex-1 min-w-0 space-y-1 text-slate-800">
                    <div>
                      <h4 className="text-xs font-black text-slate-950 truncate leading-tight">
                        {student.full_name || "Tanpa Nama"}
                      </h4>
                      <p className="text-[10px] font-mono font-bold text-emerald-700">
                        NIS: {student.nis}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[10px] border-t border-slate-200 pt-1">
                      <div>
                        <span className="text-slate-400 text-[8px] uppercase block font-bold">Kelas</span>
                        <span className="font-extrabold text-slate-900">{student.class_name ? `Kls ${student.class_name}` : "-"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[8px] uppercase block font-bold">Kamar</span>
                        <span className="font-extrabold text-slate-900">{student.room ? `Kam. ${student.room}` : "-"}</span>
                      </div>
                    </div>
                  </div>

                  {/* QR Code Dinamis */}
                  <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                    <QRCode
                      value={qrPayload}
                      size={60}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      viewBox={`0 0 60 60`}
                    />
                  </div>
                </div>

                {/* FOOTER KARTU */}
                <div className="bg-slate-100 px-3 py-1 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-500 font-bold">
                  <span>Sistem Aplikasi Pengasuhan Santri</span>
                  <span className="font-mono">Thn Masuk: {student.entry_year || "-"}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER MODAL */}
        <div className="no-print flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition active:scale-95 shadow-sm"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition active:scale-95"
          >
            Cetak Semua Kartu
          </button>
        </div>

      </div>
    </div>
  );
}