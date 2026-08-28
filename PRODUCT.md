# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Next.js 16.3.1 (React 19, TypeScript), Tailwind CSS v4, Supabase (Database, SSR, Auth, Storage)

## Users
Primary operators at Pondok Pesantren Riyadlul Ulum Wadda'wah Condong (Tasikmalaya, Indonesia):
- **Super Admin:** Overall system manager with access to users management, settings, audit logs, and master lists.
- **Staf Pengasuhan (Parenting Staff):** Teachers and boarding school supervisors logging student discipline violations, merit/achievement points, and managing student exit and return permissions.
- **Staf Satpam / Petugas Keamanan (Security Guard):** Gatekeepers scanning student QR codes from physical ID cards (KTS) or mobile screens to record actual exit and return timestamps at the gate.

## Product Purpose
SIPS (Sistem Informasi Pengasuhan Santri) is an integrated digital hub that streamlines and automates boarding school student discipline, security, and parent communication. Success means eliminating paper-based logs, providing flawless offline scanning at physical gates, and offering instant, real-time transparency to parents.

## Positioning
SIPS bridges physical gate security with administrative boarding school software, uniquely integrating offline-first QR scanning with configurable, automated WhatsApp notifications straight to parents/guardians (wali santri) when their children leave/return or receive disciplinary/achievement records.

## Operating Context
- **Gate / Pos Satpam:** Outdoor/indoor environments with varying lighting and highly unstable network connectivity. Security guards use low-end or mid-range tablets/smartphones as a PWA to scan student QR codes.
- **Office / Biro Pengasuhan:** Desktop computers used by parenting staff to review permit lists, print Student Cards (KTS), log violations/achievements, and download Excel/PDF reports.

## Capabilities and Constraints
### Capabilities
- **Master Santri:** CRUD operations for student records, Excel template downloads, and bulk Excel imports.
- **Cetak KTS Santri:** Generating and printing Student Identity Cards (Kartu Tanda Santri) with unified, standard NIS-murni QR codes.
- **Biro Perizinan:** Detailed workflow for managing student permits (exit, return target, status).
- **Pelanggaran & Poin:** Registering student disciplinary violations with points.
- **Prestasi Santri:** Registering student achievements with merit points.
- **Pusat Laporan:** Exporting comprehensive, highly-formatted Excel and PDF reports.
- **Portal Pos Keamanan Gerbang:** Real-time web-camera QR scanner supporting standard SIPS QR payloads (NIS murni) and legacy formats.
- **WhatsApp Integrations:** Automated, customizable alerts triggered on permissions, violations, and achievements (with a global toggle in settings to enable/disable).
- **Offline Queueing:** Local client-side queueing (`offlineQueue.ts`) ensuring QR scans are captured and synced once the network is restored.

### Constraints
- Database/Auth/SSR through Supabase client with strict RLS policies.
- Clean standard format of QR payloads (pure NIS).
- Limited connectivity at physical gates requiring PWA capability and reliable offline storage.

## Brand Commitments
- **Name:** SIPS (Sistem Informasi Pengasuhan Santri / Sistem Integrasi Pengasuhan Santri)
- **Institution:** Pondok Pesantren Riyadlul Ulum Wadda'wah Condong Tasikmalaya
- **Visuals:** Formal, high-authority identity represented by the official Pesantren Condong logo, structured layouts, high-contrast dark/light mode, and clear visual indicators.

## Evidence on Hand
- Complete Next.js 16.3 / React 19 app router source code.
- Operational integrations in `src/lib/whatsapp.ts`, `src/lib/offlineQueue.ts`, and `src/lib/qrParser.ts`.
- Structured dashboard pages and modals.

## Product Principles
- **Uncompromised Reliability:** Flawless operations under intermittent network conditions at gate positions through robust offline support.
- **Immediate Parental Communication:** Configurable, automated real-time transparency via WhatsApp notifications to build trust.
- **Ease of Physical Operation:** Large, accessible UI elements and fast camera scanning optimized for security guards wearing gloves or operating in bright outdoor conditions.
- **Data Integrity and Auditability:** Complete tracing of all status changes, gate officers, timestamps, and manual updates.

## Accessibility & Inclusion
- Responsive design tailored for entry-level and mid-range mobile and tablet devices used by security guards.
- High-contrast color palettes and light/dark mode support.
- Clear audio cues ("success" or "error" sounds) for QR scans at the gate.
