import { z } from 'zod';

export const breakSessionSchema = z
  .object({
    id: z.string().min(1),
    shiftId: z.string().min(1),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }).optional(),
    isPaid: z.boolean(),
    source: z.enum(['tracked', 'manual']),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .superRefine((session, context) => {
    if (session.end && new Date(session.end).getTime() <= new Date(session.start).getTime()) {
      context.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'Break end must be after break start.',
      });
    }
  });

export type BreakSession = z.infer<typeof breakSessionSchema>;
