import { z } from "zod";

export const saveApolloApiKeySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20, "That doesn't look like a valid API key")
    .max(200, "Key is too long"),
});

export type SaveApolloApiKeyInput = z.infer<typeof saveApolloApiKeySchema>;

export const apolloSearchSchema = z.object({
  personTitles: z.string().trim().optional().or(z.literal("")),
  personSeniorities: z.string().trim().optional().or(z.literal("")),
  organizationName: z.string().trim().optional().or(z.literal("")),
  organizationDomains: z.string().trim().optional().or(z.literal("")),
  locations: z.string().trim().optional().or(z.literal("")),
  keywords: z.string().trim().optional().or(z.literal("")),
  employeeRanges: z.string().trim().optional().or(z.literal("")),
  excludeTitles: z.string().trim().optional().or(z.literal("")),
  excludeDomains: z.string().trim().optional().or(z.literal("")),
});

export type ApolloSearchInput = z.infer<typeof apolloSearchSchema>;
