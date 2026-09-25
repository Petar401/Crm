import "server-only";

import type OpenAI from "openai";

import { lookupPostcode } from "@/features/tools/postcodes";
import {
  DEFAULT_DIVISION,
  bankHolidayOn,
  getBankHolidays,
  isDivision,
  todayInUk,
  upcomingHolidays,
} from "@/features/tools/bank-holidays";
import { checkEmailDomain } from "@/features/tools/email-domain";

/**
 * Keyless public-data tools Aria can call alongside read_workspace_file:
 * UK postcode lookup (postcodes.io), UK bank holidays (GOV.UK) and an email
 * domain MX check (server DNS). None of them read workspace data, so they need
 * no permission beyond `ai.use`, which the chat action already enforces.
 */
export const FREE_TOOL_DEFINITIONS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "lookup_uk_postcode",
      description:
        "Look up a UK postcode: local authority district, county, region, nation, ward, constituency and latitude/longitude. Use to fill in or check an address, or to say roughly where a customer is.",
      parameters: {
        type: "object",
        properties: {
          postcode: { type: "string", description: "A UK postcode, e.g. \"CB2 1AN\"." },
        },
        required: ["postcode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "uk_bank_holidays",
      description:
        "List upcoming UK bank holidays, or check whether a given date is one. Use when planning due dates, visits or follow-ups.",
      parameters: {
        type: "object",
        properties: {
          division: {
            type: "string",
            enum: ["england-and-wales", "scotland", "northern-ireland"],
            description: "Defaults to england-and-wales.",
          },
          date: {
            type: "string",
            description: "Optional YYYY-MM-DD: check whether this date is a bank holiday.",
          },
          count: {
            type: "number",
            description: "How many upcoming holidays to list (1-20, default 5).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_email_domain",
      description:
        "Check whether an email address's domain can receive mail (DNS MX lookup). Proves the domain accepts email, not that the mailbox exists.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "The email address to check." },
        },
        required: ["email"],
      },
    },
  },
];

type Handler = (args: Record<string, unknown>) => Promise<string>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const FREE_TOOL_HANDLERS: Record<string, Handler> = {
  async lookup_uk_postcode(args) {
    const result = await lookupPostcode(str(args.postcode));
    if (result.status === "ok") return JSON.stringify(result.info);
    return {
      invalid: "[That isn't a valid UK postcode.]",
      not_found: "[That postcode doesn't exist or is no longer in use.]",
      unavailable: "[The postcode service is unavailable right now.]",
    }[result.status];
  },

  async uk_bank_holidays(args) {
    const division = isDivision(args.division) ? args.division : DEFAULT_DIVISION;
    const holidays = await getBankHolidays(division);
    if (!holidays) return "[The GOV.UK bank holiday feed is unavailable right now.]";
    const date = str(args.date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const hit = bankHolidayOn(holidays, date);
      return JSON.stringify({ division, date, isBankHoliday: Boolean(hit), holiday: hit });
    }
    const count = Math.min(Math.max(Math.trunc(Number(args.count) || 5), 1), 20);
    return JSON.stringify({
      division,
      today: todayInUk(),
      upcoming: upcomingHolidays(holidays, todayInUk(), count),
    });
  },

  async check_email_domain(args) {
    return JSON.stringify(await checkEmailDomain(str(args.email)));
  },
};

/** Runs a free tool by name. Returns null when the name isn't a free tool. */
export async function runFreeTool(
  name: string,
  rawArguments: string | undefined
): Promise<string | null> {
  // Own properties only: a model-supplied name such as "constructor" or
  // "toString" must not resolve to an Object.prototype function.
  if (!Object.hasOwn(FREE_TOOL_HANDLERS, name)) return null;
  const handler = FREE_TOOL_HANDLERS[name];
  let args: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawArguments || "{}");
    args = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return "[Could not run the tool: invalid arguments.]";
  }
  try {
    return await handler(args);
  } catch {
    return "[The tool failed unexpectedly. Try again later.]";
  }
}
