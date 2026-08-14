"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ConnectWallet } from "@/components/dashboard/ConnectWallet";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { fetchCurrentUser, logout } from "@/lib/wallet";

type DashboardGateProps = {
  children: React.ReactNode;
};

function logoutOnClose() {
  // keepalive so the request survives tab close; cookies cleared by Set-Cookie
  void fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

function DashboardLoading() {
  return (
    <DashboardShell>
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.14em] text-white/35">
          Loading…
        </p>
      </div>
    </DashboardShell>
  );
}

function DashboardGateInner({ children }: DashboardGateProps) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const autoConnectFreighter = searchParams.get("connect") === "freighter";

  const clearConnectParam = useCallback(() => {
    if (searchParams.get("connect")) {
      router.replace(pathname, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((user) => {
        if (!cancelled) setPublicKey(user?.publicKey ?? null);
      })
      .catch(() => {
        if (!cancelled) setPublicKey(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Logout when the tab/window is closed (or hard-refreshed)
  useEffect(() => {
    if (!publicKey) return;

    const onPageHide = (event: PageTransitionEvent) => {
      // Skip bfcache freeze — user may come back without a full unload
      if (event.persisted) return;
      logoutOnClose();
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [publicKey]);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      /* still clear local session UI */
    }
    setPublicKey(null);
  }

  if (checking) {
    return <DashboardLoading />;
  }

  if (!publicKey) {
    return (
      <DashboardShell>
        <div className="py-6 md:py-10">
          <ConnectWallet
            onConnected={setPublicKey}
            autoConnectFreighter={autoConnectFreighter}
            onAutoConnectHandled={clearConnectParam}
          />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell publicKey={publicKey} onLogout={handleLogout}>
      {children}
    </DashboardShell>
  );
}

export function DashboardGate({ children }: DashboardGateProps) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardGateInner>{children}</DashboardGateInner>
    </Suspense>
  );
}
