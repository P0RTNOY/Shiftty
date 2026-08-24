import { create } from 'zustand';

import type { Shift, RecurrenceSeries } from '@/domain/entities';
import type { RecurrenceRepository, ShiftRepository, ShiftTemplateRepository } from '@/domain/repositories';
import { restoreActiveShift } from '@/domain/services';
import { checkAllSeriesRollingWindows } from '@/domain/services/recurrence-window-service';
import { createScheduledShift } from '@/domain/services/shift-factory';
import { formatLocalDateKey } from '@/shared/utils/zoned-time';

type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AppState {
  bootstrapStatus: BootstrapStatus;
  bootstrapError: string | null;
  activeShift: Shift | null;
  setActiveShift: (shift: Shift | null) => void;
  bootstrap: (repos: { shifts: ShiftRepository; recurrence: RecurrenceRepository; templates: ShiftTemplateRepository }) => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  bootstrapStatus: 'idle',
  bootstrapError: null,
  activeShift: null,
  setActiveShift: (activeShift) => set({ activeShift }),
  async bootstrap(repos) {
    set({ bootstrapStatus: 'loading', bootstrapError: null });
    try {
      // 1. Restore active shift
      const activeShift = await restoreActiveShift(repos.shifts);
      
      // 2. Extend recurrence rolling windows
      const allSeries = await repos.recurrence.listAll();
      const shiftsBySeries = new Map<string, string[]>();
      const seriesWithExceptions = [];

      for (const series of allSeries) {
        const [generatedShifts, exceptions] = await Promise.all([
          repos.shifts.list({ recurrenceGroupId: series.id }),
          repos.recurrence.listExceptions(series.id),
        ]);
        shiftsBySeries.set(series.id, generatedShifts.flatMap((shift: Shift) => {
          const start = shift.recurrenceOriginalStart ?? shift.scheduledStart;
          return start ? [formatLocalDateKey(start, series.rule.timezone)] : [];
        }));
        seriesWithExceptions.push({ series, exceptions });
      }

      const windowResults = checkAllSeriesRollingWindows(
        seriesWithExceptions,
        shiftsBySeries,
        new Date()
      );

      const nowString = new Date().toISOString();
      for (const [seriesId, result] of windowResults.entries()) {
        if (result.needsExtension && result.occurrencesToCreate.length > 0) {
          const series = allSeries.find((s: RecurrenceSeries) => s.id === seriesId)!;
          const occurrences = result.occurrencesToCreate.flatMap((occurrence) => {
            try {
              const shift = createScheduledShift({
                workplaceId: series.template.workplaceId,
                roleId: series.template.roleId,
                shiftTemplateId: series.template.shiftTemplateId,
                shiftTypeNameSnapshot: series.template.shiftTypeNameSnapshot,
                shiftTypePayMultiplierBasisPoints: series.template.shiftTypePayMultiplierBasisPoints,
                title: series.template.title,
                notes: series.template.notes,
                hourlyRateSnapshotMinor: series.template.hourlyRateSnapshotMinor,
                date: occurrence.localDate,
                startTime: series.template.startTime,
                endTime: series.template.endTime,
                expectedBreakMinutes: series.template.expectedBreakMinutes,
              }, {
                id: occurrence.id,
                now: nowString,
                timezone: series.rule.timezone,
              });
              return [{ ...shift, recurrenceGroupId: series.id, recurrenceOriginalStart: occurrence.scheduledStart }];
            } catch (caught) {
              if (caught instanceof Error && caught.message.includes('cannot exceed 12 hours')) return [];
              throw caught;
            }
          });
          await repos.recurrence.materializeOccurrences(series, occurrences);
        }
      }

      set({ activeShift, bootstrapStatus: 'ready' });
    } catch (error) {
      set({
        bootstrapStatus: 'error',
        bootstrapError: error instanceof Error ? error.message : String(error),
      });
    }
  },
}));
