import { z } from 'zod';

export const appSettingsSchema = z.object({
  locale: z.enum(['he', 'en']).default('he'),
  timezone: z.string().min(1).default('Asia/Jerusalem'),
  currency: z.string().length(3).default('ILS'),
  colorScheme: z.enum(['system', 'light', 'dark']).default('system'),
  roundingMinutes: z.number().int().min(0).max(60).default(0),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_APP_SETTINGS: AppSettings = appSettingsSchema.parse({});
