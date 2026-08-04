import { z } from 'zod';
import { ExportFormatSchema } from './export-preset';

export const ExportStatusSchema = z.enum(['success', 'failure']);
export type ExportStatus = z.infer<typeof ExportStatusSchema>;

export const ExportHistorySchema = z.object({
  id: z.string().uuid(),
  format: ExportFormatSchema,
  presetId: z.string().uuid().optional(),
  reportingPeriod: z.string().optional(),
  workplaceFilter: z.string().optional(),
  generatedAt: z.string().datetime(),
  sanitizedFilename: z.string().optional(),
  status: ExportStatusSchema,
  createdAt: z.string().datetime(),
});

export type ExportHistory = z.infer<typeof ExportHistorySchema>;
