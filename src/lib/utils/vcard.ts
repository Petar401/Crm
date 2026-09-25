import { escapeIcsText, foldIcsLine } from "@/lib/utils/ics";

/**
 * vCard 3.0 builder (RFC 2426) for exporting contacts to phone and desktop
 * address books. 3.0 is the version iOS, Android and Outlook all import.
 * Dependency-free and pure.
 */

export interface VCardContact {
  uid?: string | null;
  firstName: string;
  lastName?: string | null;
  organization?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
}

/** vCard TEXT escaping is the same as iCalendar's (RFC 2426 §4 / RFC 5545). */
export const escapeVCardText = escapeIcsText;

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function buildVCard(contact: VCardContact): string {
  const first = clean(contact.firstName);
  const last = clean(contact.lastName);
  const full = [first, last].filter(Boolean).join(" ") || clean(contact.email) || "Contact";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCardText(last)};${escapeVCardText(first)};;;`,
    `FN:${escapeVCardText(full)}`,
  ];
  const org = clean(contact.organization);
  if (org) lines.push(`ORG:${escapeVCardText(org)}`);
  const title = clean(contact.title);
  if (title) lines.push(`TITLE:${escapeVCardText(title)}`);
  const email = clean(contact.email);
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardText(email)}`);
  const phone = clean(contact.phone);
  if (phone) lines.push(`TEL;TYPE=WORK,VOICE:${escapeVCardText(phone)}`);
  const note = clean(contact.note);
  if (note) lines.push(`NOTE:${escapeVCardText(note)}`);
  const uid = clean(contact.uid);
  if (uid) lines.push(`UID:${escapeVCardText(uid)}`);
  lines.push("END:VCARD");

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** Concatenates several cards into one .vcf file. */
export function buildVCards(contacts: readonly VCardContact[]): string {
  return contacts.map(buildVCard).join("");
}
