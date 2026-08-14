"use client";

import { useEffect, useState } from "react";

type LoginQrProps = {
  url: string;
  size?: number;
};

/** QR encodes the mobile login URL for the desktop connect screen. */
export function LoginQr({ url, size = 220 }: LoginQrProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(url, {
          width: size,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        })
      )
      .then((u) => {
        if (!cancelled) setDataUrl(u);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div
        className="mx-auto flex items-center justify-center rounded-lg bg-white/10 text-xs text-white/40"
        style={{ width: size, height: size }}
        aria-hidden
      >
        QR…
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="QR code to sign in on your phone"
      width={size}
      height={size}
      className="mx-auto rounded-lg bg-white p-2"
    />
  );
}
