"use client";

import { useGSAP } from "@gsap/react";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";

type AddressQrProps = {
  publicKey: string;
  size?: number;
};

/** QR encodes the raw G-address — what most Stellar wallets expect when scanning. */
export function AddressQr({ publicKey, size = 168 }: AddressQrProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    import("qrcode")
      .then((QR) =>
        QR.toDataURL(publicKey, {
          width: size * 2,
          margin: 1,
          color: { dark: "#0a0a0a", light: "#ffffff" },
          errorCorrectionLevel: "M",
        })
      )
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [publicKey, size]);

  useGSAP(
    () => {
      if (!dataUrl || !wrap.current) return;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (reduced) return;

      gsap.fromTo(
        wrap.current,
        { opacity: 0, scale: 0.92, rotate: -2 },
        {
          opacity: 1,
          scale: 1,
          rotate: 0,
          duration: 0.75,
          ease: "back.out(1.4)",
        }
      );
    },
    { dependencies: [dataUrl] }
  );

  if (!dataUrl) {
    return (
      <div
        className="dash-qr flex animate-pulse items-center justify-center rounded-[1.25rem] bg-white/[0.06]"
        style={{ width: size + 28, height: size + 28 }}
        aria-hidden
      >
        <span className="text-[11px] tracking-wide text-white/35">QR</span>
      </div>
    );
  }

  return (
    <div
      ref={wrap}
      className="dash-qr rounded-[1.25rem] bg-white p-3.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_50px_rgba(0,0,0,0.45)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02]"
      style={{ width: size + 28, height: size + 28 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`QR code for Stellar address ${publicKey}`}
        width={size}
        height={size}
        className="h-full w-full rounded-xl"
      />
    </div>
  );
}
