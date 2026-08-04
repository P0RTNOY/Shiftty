import { z } from 'zod';

export const ExportFormatSchema = z.enum(['pdf', 'csv', 'ics', 'backup']);
export type ExportFormatType = z.infer<typeof ExportFormatSchema>;

export const ExportPresetConfigSchema = z.object({
  // Common properties
  periodType: z.enum(['month', 'year', 'custom', 'all']),
  customPeriodStart: z.string().optional(),
  customPeriodEnd: z.string().optional(),
  workplaceIds: z.array(z.string()).optional(), // empty means all

  // CSV specific
  csvIncludeBOM: z.boolean().optional(),
  csvDelimiter: z.string().optional(),

  // PDF specific
  pdfIncludeNotes: z.boolean().optional(),
  pdfIncludeTotals: z.boolean().optional(),

  // ICS specific
  icsIncludeSalary: z.boolean().optional(),
});
export type ExportPresetConfig = z.infer<typeof ExportPresetConfigSchema>;

export const ExportPresetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  format: ExportFormatSchema,
  config: ExportPresetConfigSchema,
  isArchived: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ExportPreset = z.infer<typeof ExportPresetSchema>;
