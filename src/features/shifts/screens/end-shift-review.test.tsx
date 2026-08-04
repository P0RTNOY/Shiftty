import { screen } from '@testing-library/react-native';
import EndShiftReviewScreen from '@/app/shifts/active/end';
import { renderApp } from '@/test/render';
import { createBreak, createShift } from '@/test/fixtures';

const mockActiveHook = jest.fn();
jest.mock('@/features/shifts/hooks/use-active-shift', () => ({ useActiveShift: () => mockActiveHook() }));

describe('end shift review screen', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-07-15T22:07:00+03:00')); });
  afterEach(() => jest.useRealTimers());

  it('shows separate ranges and all payable choices', () => {
    mockActiveHook.mockReturnValue({ activeShift: createShift({ status: 'active', actualStart: '2026-07-15T13:24:00+03:00', activeOrigin: 'scheduled' }), breaks: [createBreak()], busy: false, completeShift: jest.fn(), endBreak: jest.fn() }); renderApp(<EndShiftReviewScreen />);
    expect(screen.getByText('בדיקה לפני סיום המשמרת')).toBeTruthy(); expect(screen.getByText('עבודה נטו בפועל')).toBeTruthy(); expect(screen.getByRole('radio', { name: 'השתמש בשעות בפועל' })).toBeTruthy(); expect(screen.getByRole('radio', { name: 'עריכה ידנית' })).toBeTruthy();
  });

  it('requires an explicit open-break resolution before completion', () => {
    mockActiveHook.mockReturnValue({ activeShift: createShift({ status: 'active', actualStart: '2026-07-15T13:24:00+03:00', activeOrigin: 'scheduled' }), breaks: [createBreak({ end: undefined, start: '2026-07-15T21:50:00+03:00' })], busy: false, completeShift: jest.fn(), endBreak: jest.fn() }); renderApp(<EndShiftReviewScreen />);
    expect(screen.getByText('יש הפסקה פעילה')).toBeTruthy(); expect(screen.getByRole('button', { name: 'אישור וסיום המשמרת' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'סיום ההפסקה עכשיו והמשך' })).toBeTruthy();
  });
});
