import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import PayRulesScreen from '@/app/settings/salary/rules';
import { createPayRule } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const mockSave = jest.fn().mockResolvedValue(undefined);
const mockListForProfile = jest.fn().mockResolvedValue([]);
const mockParams = jest.fn(() => ({ profileId: 'profile-1', kind: 'specialInterval', intervalType: 'weekly_rest' }));
let mockFocusInvoked = false;

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useFocusEffect: (callback: () => void) => { if (!mockFocusInvoked) { mockFocusInvoked = true; callback(); } },
  useLocalSearchParams: () => mockParams(),
}));
jest.mock('@/features/shifts/hooks/use-repositories', () => ({
  useRepositories: () => ({ payRules: { save: mockSave, listForProfile: mockListForProfile, delete: jest.fn() } }),
}));

describe('special-interval pay-rule editor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusInvoked = false;
    mockParams.mockReturnValue({ profileId: 'profile-1', kind: 'specialInterval', intervalType: 'weekly_rest' });
    mockListForProfile.mockResolvedValue([]);
  });

  it('creates an explicit special premium family without embedding calendar evidence', async () => {
    renderApp(<PayRulesScreen />);

    await screen.findByLabelText('שם החוק');
    expect(screen.getByRole('radio', { name: 'חגים וזמנים מיוחדים' }).props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByRole('checkbox', { name: 'מנוחה שבועית' }).props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByText('✓ מנוחה שבועית')).toBeTruthy();
    expect(screen.getByText(/הוספת טווח לבדה לא משנה שכר/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('שם החוק'), 'מכפיל מנוחה');
    fireEvent.press(screen.getByRole('button', { name: 'הוספת חוק' }));

    await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'מכפיל מנוחה',
      conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }],
      effect: { type: 'multiplier', basisPoints: 12_500 },
      premiumFamily: 'special_interval',
    })));
  });

  it('keeps a legacy holiday condition serialized when it is edited', async () => {
    mockParams.mockReturnValue({ profileId: 'profile-1', kind: '', intervalType: '' });
    mockListForProfile.mockResolvedValue([createPayRule({ id: 'legacy', name: 'חג ישן', conditions: [{ type: 'holiday' }], effect: { type: 'multiplier', basisPoints: 15_000 } })]);
    renderApp(<PayRulesScreen />);
    await screen.findByText('חג ישן');
    fireEvent.press(screen.getByRole('button', { name: 'עריכה' }));
    fireEvent.press(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'legacy', conditions: [{ type: 'holiday' }], premiumFamily: undefined })));
  });
});
