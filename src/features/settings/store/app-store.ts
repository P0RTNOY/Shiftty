import { create } from 'zustand';

import type { Shift, RecurrenceSeries } from '@/domain/entities';
import type { RecurrenceRepository, ShiftRepository, ShiftTemplateRepository } from '@/domain/repositories';
import { restoreActiveShift } from '@/domain/services';
import { checkAllSeriesRollingWindows } from '@/domain/services/recurrence-window-service';
import { createScheduledShift } from '@/domain/services/shift-factory';
import { createId } from '@/shared/utils/id';

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
      
      // We need to fetch existing shift dates for each series to know what's already generated
      for (const series of allSeries) {
        const generatedShifts = await repos.shifts.list({ recurrenceGroupId: series.id });
        shiftsBySeries.set(series.id, generatedShifts.map((s: Shift) => s.scheduledStart!.split('T')[0]!));
      }

      const windowResults = checkAllSeriesRollingWindows(
        allSeries.map((s: RecurrenceSeries) => ({ series: s, exceptions: [] })), // Real exceptions should be loaded if supported in the future
        shiftsBySeries,
        new Date()
      );

      // Save generated occurrences
      const nowString = new Date().toISOString();
      for (const [seriesId, result] of windowResults.entries()) {
        if (result.needsExtension && result.occurrencesToCreate.length > 0) {
          const series = allSeries.find((s: RecurrenceSeries) => s.id === seriesId)!;
          const template = await repos.templates.getById(series.template.shiftTemplateId ?? series.template.workplaceId); // This is just mock logic for bootstrap, real factory is complex
          if (template) {
            for (const occurrence of result.occurrencesToCreate) {
              const shift = createScheduledShift({
                workplaceId: series.template.workplaceId,
                roleId: series.template.roleId,
                shiftTemplateId: series.template.shiftTemplateId,
                hourlyRateSnapshotMinor: series.template.hourlyRateSnapshotMinor,
                date: occurrence.localDate,
                startTime: series.template.startTime,
                endTime: series.template.endTime,
                expectedBreakMinutes: series.template.expectedBreakMinutes,
              }, {
                id: createId('shift'),
                now: nowString,
                timezone: series.rule.timezone,
              });
              
              await repos.shifts.create({ ...shift, recurrenceGroupId: series.id });
            }
          }
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
