import { fireEvent, screen } from '@testing-library/react-native';
import { ActiveShiftPanel } from '@/features/shifts/components/active-shift-panel';
import { renderApp } from '@/test/render';
import { createBreak, createShift } from '@/test/fixtures';
import type { PayCalculationResult } from '@/domain/entities';

describe('ActiveShiftPanel', () => {
  const shift = createShift({ status: 'active', actualStart: '2026-07-15T13:00:00+03:00', expectedEnd: '2026-07-15T22:00:00+03:00', activeOrigin: 'scheduled' });

  it('renders timestamp-derived Hebrew live metrics and accessible actions', () => {
    const onStartBreak = jest.fn();
    renderApp(<ActiveShiftPanel breaks={[]} now={new Date('2026-07-15T17:00:00+03:00')} onEndShift={jest.fn()} onManageBreaks={jest.fn()} onOpenDetails={jest.fn()} onStartBreak={onStartBreak} shift={shift} workplaceName="קפה העיר" />);
    expect(screen.getByText('משמרת פעילה')).toBeTruthy();
    expect(screen.getByText('עובדים')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'הפסקה' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'יציאה' })).toBeTruthy();
    expect(screen.queryByText('הפסקות ללא תשלום')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'הפסקה' }));
    expect(onStartBreak).toHaveBeenCalledWith(false);
  });

  it('shows the running break and only offers returning from it', () => {
    const onEndBreak = jest.fn();
    renderApp(<ActiveShiftPanel breaks={[createBreak({ end: undefined, start: '2026-07-15T16:52:00+03:00' })]} now={new Date('2026-07-15T17:00:00+03:00')} onEndBreak={onEndBreak} onEndShift={jest.fn()} onManageBreaks={jest.fn()} onOpenDetails={jest.fn()} onStartBreak={jest.fn()} shift={shift} workplaceName="קפה העיר" />);
    expect(screen.getByText('בהפסקה')).toBeTruthy();
    expect(screen.getByText('זמן כולל')).toBeTruthy();
    expect(screen.getByText('משך ההפסקה הנוכחית')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'חזרה לעבודה' }));
    expect(onEndBreak).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'הפסקה' })).toBeNull();
  });

  it('labels the live amount as estimated and exposes its assumptions', () => {
    const salaryResult = {
      totalGrossPayMinor: 24_000,
      issues: [{ code: 'default_overtime_applied', severity: 'warning', messageKey: 'salary.defaultOvertimeApplied' }],
      appliedRuleIds: [],
      explanations: ['salary.explanations.default_overtime'],
      fixedBonusesMinor: 0,
      reimbursementsMinor: 0,
    } as unknown as PayCalculationResult;

    renderApp(<ActiveShiftPanel
      breaks={[]}
      now={new Date('2026-07-15T17:00:00+03:00')}
      onEndShift={jest.fn()}
      onManageBreaks={jest.fn()}
      onOpenDetails={jest.fn()}
      onStartBreak={jest.fn()}
      provisionalPay="₪240.00"
      salaryResult={salaryResult}
      shift={shift}
      workplaceName="קפה העיר"
    />);

    expect(screen.getByText('שכר משוער עד עכשיו')).toBeTruthy();
    expect(screen.getByText('₪240.00')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'איך חושב הסכום?' })).toBeTruthy();
  });
});
