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
  organizationName: z.string().trim().optional().or(z.literal("")),
  organizationDomain: z.string().trim().optional().or(z.literal("")),
  location: z.string().trim().optional().or(z.literal("")),
});

export type ApolloSearchInput = z.infer<typeof apolloSearchSchema>;
