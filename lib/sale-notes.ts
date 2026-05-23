const PENDING_REASON_LABEL = "Motivo pendiente:";
const SALE_NOTE_LABEL = "Nota:";

function toOptionalText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function buildSaleNotesPayload({
  pendingReason,
  note,
}: {
  pendingReason?: string | null;
  note?: string | null;
}) {
  const normalizedPendingReason = toOptionalText(pendingReason);
  const normalizedNote = toOptionalText(note);

  if (normalizedPendingReason && normalizedNote) {
    return `${PENDING_REASON_LABEL} ${normalizedPendingReason}\n${SALE_NOTE_LABEL} ${normalizedNote}`;
  }
  if (normalizedPendingReason) {
    return `${PENDING_REASON_LABEL} ${normalizedPendingReason}`;
  }
  return normalizedNote
    ? `${SALE_NOTE_LABEL} ${normalizedNote}`
    : undefined;
}

export function parseSaleNotesPayload(value: unknown) {
  const raw = toOptionalText(value);
  if (!raw) {
    return {
      pendingReason: undefined,
      note: undefined,
      isStructured: false,
    };
  }

  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  let currentSection: "pendingReason" | "note" | null = null;
  let pendingReason = "";
  let note = "";

  lines.forEach((line) => {
    if (!line) return;

    if (line.startsWith(PENDING_REASON_LABEL)) {
      currentSection = "pendingReason";
      pendingReason = line.slice(PENDING_REASON_LABEL.length).trim();
      return;
    }

    if (line.startsWith(SALE_NOTE_LABEL)) {
      currentSection = "note";
      note = line.slice(SALE_NOTE_LABEL.length).trim();
      return;
    }

    if (currentSection === "pendingReason") {
      pendingReason = [pendingReason, line].filter(Boolean).join("\n");
      return;
    }

    if (currentSection === "note") {
      note = [note, line].filter(Boolean).join("\n");
    }
  });

  return {
    pendingReason: toOptionalText(pendingReason),
    note: toOptionalText(note),
    isStructured: Boolean(toOptionalText(pendingReason) || toOptionalText(note)),
  };
}
