import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { BreakSession, Shift } from '@/domain/entities';
import type { ActiveShiftCancellationMode, CompleteShiftInput } from '@/domain/repositories';
import { useAppStore } from '@/features/settings/store/app-store';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { createId } from '@/shared/utils/id';
import { ActiveShiftNotifications } from '@/features/shifts/notifications/active-shift-notifications';
import { useTranslation } from '@/shared/i18n';
import { SalaryCalculationCoordinator } from '@/features/pay-rules/services/salary-calculation-coordinator';

export function useActiveShift() {
  const { locale } = useTranslation();
  const repositories = useRepositories();
  const activeShift = useAppStore((state) => state.activeShift);
  const setActiveShift = useAppStore((state) => state.setActiveShift);
  const [breaks, setBreaks] = useState<BreakSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const mutation = useRef(false);
  const notifications = useMemo(() => new ActiveShiftNotifications(), []);
  const salaryCoordinator = useMemo(() => new SalaryCalculationCoordinator(repositories), [repositories]);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const notify = useCallback(async (operation: () => Promise<unknown>) => {
    try { await operation(); setNotificationError(null); }
    catch (caught) { setNotificationError(toMessage(caught)); }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const shift = await repositories.activeShifts.getActiveShift();
      setActiveShift(shift);
      setBreaks(shift ? await repositories.activeShifts.listBreaks(shift.id) : []);
      setError(null);
    } catch (caught) { setError(toMessage(caught)); }
    finally { setLoading(false); }
  }, [repositories.activeShifts, setActiveShift]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    if (mutation.current) return undefined;
    mutation.current = true; setBusy(true); setError(null);
    try { const result = await operation(); await refresh(); return result; }
    catch (caught) { setError(toMessage(caught)); throw caught; }
    finally { mutation.current = false; setBusy(false); }
  }, [refresh]);

  return {
    activeShift, breaks, loading, busy, error, salaryError, notificationError, refresh,
    startScheduled: (id: string, now: string, expectedEnd?: string) => run(async () => { const shift = await repositories.activeShifts.startScheduledShift(id, now, expectedEnd); await notify(() => notifications.schedule(shift, undefined, new Date(now), locale)); return shift; }),
    startUnscheduled: (shift: Shift) => run(async () => { const started = await repositories.activeShifts.startUnscheduledShift(shift); await notify(() => notifications.schedule(started, undefined, new Date(shift.actualStart!), locale)); return started; }),
    startBreak: (paid: boolean, now: string) => {
      if (!activeShift) return Promise.reject(new Error('No active shift.'));
      return run(async () => { const session = await repositories.activeShifts.startBreak({ id: createId('break'), shiftId: activeShift.id, start: now, isPaid: paid, source: 'tracked', createdAt: now, updatedAt: now }); await notify(() => notifications.schedule(activeShift, session, new Date(now), locale)); return session; });
    },
    endBreak: (now: string) => {
      const activeBreak = breaks.find((item) => !item.end);
      if (!activeBreak) return Promise.reject(new Error('No active break.'));
      return run(async () => { const ended = await repositories.activeShifts.endBreak(activeBreak.id, now); if (activeShift) await notify(() => notifications.schedule(activeShift, undefined, new Date(now), locale)); return ended; });
    },
    updateExpectedEnd: (expectedEnd: string | undefined, now: string) => {
      if (!activeShift) return Promise.reject(new Error('No active shift.'));
      return run(async () => { const updated = await repositories.activeShifts.updateExpectedEnd(activeShift.id, expectedEnd, now); await notify(() => notifications.schedule(updated, breaks.find((item) => !item.end), new Date(now), locale)); return updated; });
    },
    completeShift: (input: CompleteShiftInput) => run(async () => {
      const completed = await repositories.activeShifts.completeShift(input);
      try { await salaryCoordinator.finalizeCompletedShift(completed, input.actualEnd); setSalaryError(null); }
      catch (caught) {
        await repositories.salaryCalculations.markIncomplete(completed.id).catch(() => undefined);
        setSalaryError(toMessage(caught));
      }
      await notify(() => notifications.cancelForShift(input.shiftId)); return completed;
    }),
    cancelActiveShift: (mode: ActiveShiftCancellationMode, now: string) => {
      if (!activeShift) return Promise.reject(new Error('No active shift.'));
      return run(async () => { await repositories.activeShifts.cancelActiveShift(activeShift.id, mode, now); await notify(() => notifications.cancelForShift(activeShift.id)); });
    },
  };
}

function toMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
