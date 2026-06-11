import { z } from "zod";

export const taskStatuses = ["todo", "in_progress", "done", "cancelled"] as const;
export const taskPriorities = ["low", "medium", "high"] as const;

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  status: z.enum(taskStatuses),
  priority: z.enum(taskPriorities),
  due_at: z.string().optional().or(z.literal("")),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  company_id: z.string().uuid().optional().or(z.literal("")),
  deal_id: z.string().uuid().optional().or(z.literal("")),
});

export type TaskInput = z.infer<typeof taskSchema>;
