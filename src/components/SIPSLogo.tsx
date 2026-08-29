"use client";

import Image from "next/image";

interface SIPSLogoProps {
  className?: string;
  showText?: boolean;
  size?: number;
}

export default function SIPSLogo({
  className = "h-10 w-10",
  showText = true,
  size = 500,
}: SIPSLogoProps) {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}>
      {/* Gambar Base Emerald Shield 3D */}
      <Image
        src="/sips-logo.png"
        alt="SIPS Logo"
        width={size}
        height={size}
        priority
        className="h-full w-full object-contain drop-shadow-md select-none pointer-events-none"
      />

      {/* Teks SIPS Melengkung di Atas Pita */}
      {showText && (
        <svg
          viewBox="0 0 500 500"
          className="absolute inset-0 h-full w-full pointer-events-none select-none"
        >
          <defs>
            {/* Jalur Lengkungan Pas di Pita Putih */}
            <path
              id="emeraldRibbonCurve"
              d="M 125 358 Q 250 286 375 358"
              fill="none"
            />
            {/* Gradient Tulisan SIPS Emerald Gelap */}
            <linearGradient id="sipsTextGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#064e3b" />
              <stop offset="50%" stopColor="#022c22" />
              <stop offset="100%" stopColor="#064e3b" />
            </linearGradient>
          </defs>

          <text
            fill="url(#sipsTextGrad)"
            fontSize="46"
            fontFamily="'Arial Black', 'Montserrat', 'Segoe UI', sans-serif"
            fontWeight="900"
            letterSpacing="8"
          >
            <textPath
              href="#emeraldRibbonCurve"
              startOffset="50%"
              textAnchor="middle"
            >
              SIPS
            </textPath>
          </text>
        </svg>
      )}
    </div>
  );
}