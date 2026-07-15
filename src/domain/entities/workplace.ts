import { z } from 'zod';

export const roleSchema = z.object({
  id: z.string().min(1),
  workplaceId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  hourlyRateMinor: z.number().int().min(0).optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type Role = z.infer<typeof roleSchema>;

export const workplaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(300).optional(),
  defaultHourlyRateMinor: z.number().int().min(0),
  defaultBreakMinutes: z.number().int().min(0),
  salaryProfileId: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type Workplace = z.infer<typeof workplaceSchema>;
