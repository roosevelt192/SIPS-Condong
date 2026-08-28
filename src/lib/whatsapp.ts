interface WhatsAppNotificationParams {
  phone: string;
  studentName: string;
  nis: string;
  actionType: "out" | "in";
  reason: string;
  targetTime: string;
  isLate?: boolean;
}

export async function sendParentGateNotification({
  phone,
  studentName,
  nis,
  actionType,
  reason,
  targetTime,
  isLate = false,
}: WhatsAppNotificationParams) {
  if (!phone) {
    console.warn("Nomor telepon wali tidak ditemukan untuk:", studentName);
    return { success: false, message: "Nomor tidak tersedia" };
  }

  // Format nomor WhatsApp (ubah format 08xx jadi 628xx)
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "62" + cleanPhone.slice(1);
  }

  const nowFormatted = new Date().toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const message =
    actionType === "out"
      ? `*NOTIFIKASI KELUAR PONDOK - BIRO PENGASUHAN SANTRI*\n\n` +
        `Assalamu'alaikum Wr. Wb.\n` +
        `Yth. Wali Santri dari *${studentName}* (NIS: ${nis}),\n\n` +
        `Menginformasikan bahwa putra/putri Bapak/Ibu telah resmi diverifikasi *KELUAR GERBANG* pondok pada:\n` +
        `⏰ Waktu: ${nowFormatted} WIB\n` +
        `📝 Keperluan: ${reason}\n` +
        `⏳ Batas Waktu Kembali: ${new Date(targetTime).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} WIB\n\n` +
        `Mohon dipantau agar kembali ke pondok tepat waktu sesuai jadwal.\n\n` +
        `_Pesan otomatis dari Sistem Integrasi Pengasuhan Santri (SIPS) Pondok Pesantren Condong._`
      : `*NOTIFIKASI KEMBALI KE PONDOK - BIRO PENGASUHAN SANTRI*\n\n` +
        `Assalamu'alaikum Wr. Wb.\n` +
        `Yth. Wali Santri dari *${studentName}* (NIS: ${nis}),\n\n` +
        `Alhamdulillah, putra/putri Bapak/Ibu telah diverifikasi *KEMBALI KE KOMPLEK PONDOK* pada:\n` +
        `⏰ Waktu: ${nowFormatted} WIB\n` +
        `📊 Status Ketepatan: ${isLate ? "⚠️ *TERLAMBAT KEMBALI*" : "✅ *TEPAT WAKTU*"}\n\n` +
        `Terima kasih atas kerja samanya.\n\n` +
        `_Pesan otomatis dari Sistem Integrasi Pengasuhan Santri (SIPS) Pondok Pesantren Condong._`;

  try {
    const response = await fetch("/api/notifications/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: cleanPhone,
        message: message,
      }),
    });

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.warn("Gagal trigger API WhatsApp:", error.message);
    return { success: false, error: error.message };
  }
}