import { z } from 'zod';

export const salaryProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  currency: z.string().length(3).default('ILS'),
  standardHourlyRateMinor: z.number().int().min(0),
  breakPolicy: z.enum(['paid', 'unpaid', 'perBreak']),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type SalaryProfile = z.infer<typeof salaryProfileSchema>;
