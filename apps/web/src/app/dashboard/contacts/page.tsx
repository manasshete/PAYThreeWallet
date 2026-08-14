"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContactView } from "@pay3/shared";
import { ContactList } from "@/components/dashboard/ContactList";
import { ContactsHeader } from "@/components/dashboard/ContactsHeader";
import {
  ResolverSwitchboard,
  type ResolverPipelineState,
} from "@/components/dashboard/ResolverSwitchboard";
import { ResolveResultBox } from "@/components/dashboard/ResolveResultBox";
import { apiFetch } from "@/lib/api";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-[14px] text-white outline-none transition-[border-color,background,box-shadow] duration-300 placeholder:text-white/25 focus:border-white/25 focus:bg-black/50 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.04)]";

const primaryBtn =
  "inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-45";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactView[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [resolveInput, setResolveInput] = useState("");
  const [resolveResult, setResolveResult] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [matchedContactId, setMatchedContactId] = useState<string | null>(null);
  const [boardState, setBoardState] = useState<ResolverPipelineState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await apiFetch<{ contacts: ContactView[] }>("/contacts");
    setContacts(data.contacts);
  }, []);

  useEffect(() => {
    refresh()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      )
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    setBoardState("idle");
    setResolvedAddress(null);
    setResolveResult(null);
    setMatchedContactId(null);
  }, [resolveInput]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/contacts", {
        method: "POST",
        body: JSON.stringify({
          name,
          stellarAddress: address,
          verified: true,
        }),
      });
      setName("");
      setAddress("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await apiFetch(`/contacts/${id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleUpdate(
    id: string,
    data: { name: string; stellarAddress: string }
  ) {
    setError(null);
    try {
      await apiFetch(`/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: data.name,
          stellarAddress: data.stellarAddress,
          verified: true,
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
      throw err;
    }
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    setResolveResult(null);
    setResolvedAddress(null);
    setMatchedContactId(null);
    setError(null);
    setBoardState("scanning");

    try {
      const result = await apiFetch<{
        ok: true;
        kind: string;
        stellarAddress: string;
        contact?: ContactView;
      }>("/contacts/resolve", {
        method: "POST",
        body: JSON.stringify({ recipient: resolveInput }),
      });
      const label = result.contact
        ? `${result.contact.name} → ${result.stellarAddress}`
        : result.stellarAddress;
      setResolveResult(`${result.kind}: ${label}`);
      setResolvedAddress(result.stellarAddress);
      setMatchedContactId(result.contact?.id ?? null);
      setBoardState("pass");
    } catch (err) {
      setResolveResult(null);
      setResolvedAddress(null);
      setMatchedContactId(null);
      setBoardState("block");
      setError(err instanceof Error ? err.message : "Resolve failed");
      window.setTimeout(() => setBoardState("idle"), 2200);
    }
  }

  return (
    <div data-dash-reveal className="contacts-page mx-auto max-w-5xl">
      <article className="overview-sheet overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#0e0e10]">
        <ContactsHeader savedCount={loading ? null : contacts.length} />

        <div className="grid lg:grid-cols-[1.05fr_1.15fr]">
          {/* Left — switchboard + saved list (like jar + balances) */}
          <div
            className="relative border-b border-white/[0.07] px-6 py-8 md:px-10 lg:border-b-0 lg:border-r lg:border-white/[0.07]"
            data-overview-block
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(168,85,247,0.06),transparent_55%)]"
              aria-hidden
            />
            <div className="relative">
              <ResolverSwitchboard
                state={boardState}
                query={resolveInput}
                output={resolvedAddress}
                contacts={contacts}
                matchedContactId={matchedContactId}
                hero
              />

              <div className="mt-6 border-t border-white/[0.07] pt-4">
                <div
                  className="mb-3 flex items-center gap-1"
                  role="tablist"
                  aria-label="Contact views"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected
                    className="relative px-2 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.16em] text-white/75"
                  >
                    Saved contacts
                    {!loading && contacts.length > 0 ? (
                      <span className="ml-1.5 text-white/35">
                        {contacts.length}
                      </span>
                    ) : null}
                    <span
                      className="absolute inset-x-2 -bottom-1 h-px bg-white/45"
                      aria-hidden
                    />
                  </button>
                </div>

                <ContactList
                  panel
                  contacts={contacts}
                  loading={loading}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                />
              </div>
            </div>
          </div>

          {/* Right — add + resolve (like fund the jar) */}
          <div className="px-6 py-8 md:px-9 md:py-9" data-overview-block>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-semibold tracking-[-0.02em]">
                  Add contact
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/40">
                  Verified only — AI will use this exact mapping.
                </p>
              </div>

              <label className="block">
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.16em] text-white/28">
                  Name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex"
                  required
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.16em] text-white/28">
                  Stellar address
                </span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="G…"
                  required
                  className={`${inputClass} font-[family-name:var(--font-jetbrains-mono)] text-[12px]`}
                />
              </label>

              <button type="submit" disabled={saving} className={primaryBtn}>
                {saving ? "Saving…" : "Save contact"}
              </button>
            </form>

            <form
              onSubmit={handleResolve}
              className="mt-8 space-y-4 border-t border-white/[0.07] pt-8"
            >
              <div>
                <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-semibold tracking-[-0.02em]">
                  Test resolver
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/40">
                  Same logic MCP payments use — name or G-address.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block min-w-0 flex-1">
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.16em] text-white/28">
                    Recipient
                  </span>
                  <input
                    value={resolveInput}
                    onChange={(e) => setResolveInput(e.target.value)}
                    placeholder="Alex or G…"
                    className={inputClass}
                  />
                </label>
                <button type="submit" className={`${primaryBtn} shrink-0`}>
                  Resolve
                </button>
              </div>

              {resolveResult ? (
                <ResolveResultBox result={resolveResult} />
              ) : (
                <p className="text-[12px] text-white/28">
                  No resolve yet — try a saved name.
                </p>
              )}
            </form>

            {error ? (
              <p className="mt-4 text-[13px] text-red-400/90" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}
