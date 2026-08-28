import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { target, message } = await req.json();

    // 1. Cek Status Sakelar On/Off di Database
    const { data: setting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "wa_notifications_enabled")
      .maybeSingle();

    const isEnabled = setting ? setting.value === true : true;

    if (!isEnabled) {
      return NextResponse.json({
        success: false,
        disabled: true,
        message: "Fitur notifikasi WhatsApp dinonaktifkan oleh Super Admin.",
      });
    }

    if (!target || !message) {
      return NextResponse.json(
        { error: "Target dan pesan wajib diisi" },
        { status: 400 }
      );
    }

    const waApiToken = process.env.WHATSAPP_API_TOKEN;
    const waApiEndpoint = process.env.WHATSAPP_API_URL || "https://api.fonnte.com/send";

    // Mode simulasi jika API token belum dikonfigurasi
    if (!waApiToken) {
      console.log(`[SIMULASI WA] Mengirim ke ${target}:\n${message}`);
      return NextResponse.json({
        success: true,
        mode: "simulation",
        message: "Notifikasi WA terkirim via mode simulasi (Token API belum dipasang).",
      });
    }

    const response = await fetch(waApiEndpoint, {
      method: "POST",
      headers: {
        Authorization: waApiToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: target,
        message: message,
        countryCode: "62",
      }),
    });

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal mengirim WhatsApp" },
      { status: 500 }
    );
  }
}