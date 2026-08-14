"use client";

import { useGSAP } from "@gsap/react";
import { useRef, useState } from "react";
import type { ContactView } from "@pay3/shared";
import { truncateKey } from "@/lib/wallet";
import { gsap } from "@/lib/gsap";

const ghostBtn =
  "rounded-full border border-white/12 px-2.5 py-1 text-[10px] text-white/55 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white";

const inputClass =
  "w-full rounded-lg border border-white/[0.08] bg-black/40 px-2.5 py-1.5 text-[12px] text-white outline-none transition-[border-color] focus:border-white/25";

type ContactListProps = {
  contacts: ContactView[];
  loading: boolean;
  onDelete: (id: string) => void;
  onUpdate?: (
    id: string,
    data: { name: string; stellarAddress: string }
  ) => Promise<void>;
  compact?: boolean;
  embedded?: boolean;
  panel?: boolean;
};

const iconBtn =
  "flex h-7 w-7 items-center justify-center rounded-full border border-white/12 text-white/55 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white";

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M7.5 2.5 9.5 4.5 4 10H2V8L7.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 3.5h7M4.5 3.5V2.5h3v1M5 5.5v3M7 5.5v3M3.5 3.5l.5 6.5h4l.5-6.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ContactRowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
      <button
        type="button"
        onClick={onEdit}
        className={iconBtn}
        aria-label="Edit contact"
      >
        <EditIcon />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={`${iconBtn} hover:border-red-400/30 hover:text-red-400/90`}
        aria-label="Delete contact"
      >
        <DeleteIcon />
      </button>
    </div>
  );
}

export function ContactList({
  contacts,
  loading,
  onDelete,
  onUpdate,
  compact = false,
  embedded = false,
  panel = false,
}: ContactListProps) {
  const list = useRef<HTMLUListElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useGSAP(
    () => {
      if (!list.current || loading) return;
      const rows = list.current.querySelectorAll("[data-contact-row]");
      if (!rows.length) return;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (reduced) return;

      gsap.fromTo(
        rows,
        { opacity: 0, y: 6 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.05,
          ease: "power3.out",
          clearProps: "transform",
        }
      );
    },
    { scope: list, dependencies: [contacts, loading] }
  );

  function startEdit(c: ContactView) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditAddress(c.stellarAddress);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditAddress("");
  }

  async function saveEdit(id: string) {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(id, { name: editName, stellarAddress: editAddress });
      cancelEdit();
    } finally {
      setSaving(false);
    }
  }

  const rowClass =
    "group flex items-center gap-3 px-3 py-2 transition-colors hover:bg-white/[0.02]";

  function renderRow(c: ContactView) {
    if (editingId === c.id) {
      return (
        <li key={c.id} data-contact-row className="px-3 py-3">
          <div className="space-y-2 rounded-lg border border-white/[0.1] bg-white/[0.03] p-3">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Name"
              className={inputClass}
              autoFocus
            />
            <input
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              placeholder="G…"
              className={`${inputClass} font-[family-name:var(--font-jetbrains-mono)] text-[11px]`}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={cancelEdit} className={ghostBtn}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveEdit(c.id)}
                disabled={saving || !editName.trim() || !editAddress.trim()}
                className={`${ghostBtn} border-white/25 text-white/80`}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </li>
      );
    }

    return (
      <li key={c.id} data-contact-row className={rowClass}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] font-[family-name:var(--font-space-grotesk)] text-[10px] font-semibold uppercase text-white/70">
          {c.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--font-space-grotesk)] text-[13px] font-medium text-white/85">
            {c.name}
          </p>
          <p className="truncate font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-white/38">
            {truncateKey(c.stellarAddress)}
          </p>
        </div>
        <ContactRowActions
          onEdit={() => startEdit(c)}
          onDelete={() => onDelete(c.id)}
        />
      </li>
    );
  }

  if (panel) {
    return (
      <div>
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded-lg bg-white/[0.04]"
              />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-[11px] text-white/35">No contacts yet.</p>
        ) : (
          <ul
            ref={list}
            className="divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.07]"
          >
            {contacts.map(renderRow)}
          </ul>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={
          embedded
            ? "mt-8 border-t border-white/[0.07] pt-6"
            : "border-t border-white/[0.07] px-5 py-3 md:px-8"
        }
        data-overview-block={embedded ? undefined : true}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.18em] text-white/32">
            Saved
          </p>
          {!loading && contacts.length > 0 ? (
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-white/25">
              {contacts.length} verified
            </p>
          ) : null}
        </div>

        {loading ? (
          <div className="h-9 animate-pulse rounded-lg bg-white/[0.04]" />
        ) : contacts.length === 0 ? (
          <p className="text-[11px] text-white/35">No contacts yet.</p>
        ) : (
          <ul
            ref={list}
            className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.07]"
          >
            {contacts.map(renderRow)}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-white/[0.07]" data-overview-block>
      <div className="flex items-center justify-between px-6 py-4 md:px-10">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.2em] text-white/35">
          Rosetta slabs
        </p>
        {!loading && contacts.length > 0 ? (
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-white/28">
            {contacts.length} verified
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3 px-6 pb-8 md:px-10">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="contacts-skeleton h-[4.5rem] animate-pulse rounded-2xl bg-white/[0.04]"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <p className="px-6 pb-8 text-[13px] text-white/40 md:px-10">
          No contacts yet — carve your first mapping above.
        </p>
      ) : (
        <ul ref={list} className="space-y-3 px-6 pb-8 md:px-10">
          {contacts.map((c) =>
            editingId === c.id ? (
              <li key={c.id} data-contact-row>
                <div className="space-y-2 rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputClass}
                    autoFocus
                  />
                  <input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className={`${inputClass} font-[family-name:var(--font-jetbrains-mono)]`}
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={cancelEdit} className={ghostBtn}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(c.id)}
                      disabled={saving}
                      className={ghostBtn}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </li>
            ) : (
              <li key={c.id} data-contact-row className="perspective-[800px]">
                <div className="rosetta-slab group relative overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-white/[0.05] via-[#0c0c0e] to-black/60 p-4 transition-[border-color,box-shadow,transform] duration-500 hover:border-cyan-400/20 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)] hover:-translate-y-0.5">
                  <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-[family-name:var(--font-space-grotesk)] text-lg font-semibold tracking-tight text-white/90">
                          {c.name}
                        </span>
                        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.14em] text-emerald-400/80">
                          verified
                        </span>
                      </div>
                      <p className="mt-2 truncate font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-white/45">
                        {c.stellarAddress}
                      </p>
                    </div>
                    <ContactRowActions
                      onEdit={() => startEdit(c)}
                      onDelete={() => onDelete(c.id)}
                    />
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
