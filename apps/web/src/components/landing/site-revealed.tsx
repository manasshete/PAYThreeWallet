"use client";

import { createContext, useContext } from "react";

export const SiteRevealedCtx = createContext(false);

export function useSiteRevealed() {
  return useContext(SiteRevealedCtx);
}
