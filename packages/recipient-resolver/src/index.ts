import { Keypair, StrKey } from "@stellar/stellar-sdk";

export type ContactRecord = {
  id: string;
  name: string;
  stellarAddress: string;
  verified: boolean;
};

export type ResolveOk = {
  ok: true;
  kind: "address" | "contact";
  stellarAddress: string;
  contact?: ContactRecord;
};

export type ResolveFail = {
  ok: false;
  reason: "not_found" | "ambiguous" | "invalid_address";
  message: string;
  matches?: ContactRecord[];
};

export type ResolveResult = ResolveOk | ResolveFail;

export function isStellarPublicKey(value: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(value.trim());
  } catch {
    return false;
  }
}

/**
 * Resolve a recipient string to exactly one Stellar address.
 * Never guesses: 0 or 2+ contact matches → fail.
 */
export function resolveRecipient(
  input: string,
  contacts: ContactRecord[]
): ResolveResult {
  const raw = input.trim();
  if (!raw) {
    return {
      ok: false,
      reason: "not_found",
      message: "Recipient is empty",
    };
  }

  if (raw.startsWith("G") && raw.length >= 56) {
    if (!isStellarPublicKey(raw)) {
      return {
        ok: false,
        reason: "invalid_address",
        message: "Invalid Stellar address",
      };
    }
    return {
      ok: true,
      kind: "address",
      stellarAddress: raw,
    };
  }

  const needle = raw.toLowerCase();
  const matches = contacts.filter(
    (c) => c.name.trim().toLowerCase() === needle
  );

  if (matches.length === 0) {
    return {
      ok: false,
      reason: "not_found",
      message: `No contact named "${raw}". Add them under Contacts, or use a G-address.`,
    };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      reason: "ambiguous",
      message: `Multiple contacts named "${raw}". Clarify which one — Pay3 never guesses.`,
      matches,
    };
  }

  const contact = matches[0]!;
  if (!isStellarPublicKey(contact.stellarAddress)) {
    return {
      ok: false,
      reason: "invalid_address",
      message: `Contact "${contact.name}" has an invalid Stellar address`,
    };
  }

  return {
    ok: true,
    kind: "contact",
    stellarAddress: contact.stellarAddress,
    contact,
  };
}

/** Assert-based self-check — fails loud if resolver logic breaks. */
export function recipientResolverSelfCheck(): void {
  const a = Keypair.random().publicKey();
  const b = Keypair.random().publicKey();

  const contacts: ContactRecord[] = [
    { id: "1", name: "Hurain", stellarAddress: a, verified: true },
    { id: "2", name: "Hurain", stellarAddress: b, verified: true },
  ];

  const direct = resolveRecipient(a, []);
  if (!direct.ok || direct.kind !== "address") {
    throw new Error("self-check: direct address failed");
  }

  const one: ContactRecord[] = [contacts[0]!];
  const byName = resolveRecipient("hurain", one);
  if (!byName.ok || byName.kind !== "contact") {
    throw new Error("self-check: unique name failed");
  }

  const none = resolveRecipient("Nobody", one);
  if (none.ok) throw new Error("self-check: not_found failed");
  if (none.reason !== "not_found") {
    throw new Error("self-check: not_found failed");
  }

  const amb = resolveRecipient("Hurain", contacts);
  if (amb.ok) throw new Error("self-check: ambiguous failed");
  if (amb.reason !== "ambiguous") {
    throw new Error("self-check: ambiguous failed");
  }
}
