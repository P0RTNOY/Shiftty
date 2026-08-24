import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import SalaryProfilesScreen from '@/app/settings/salary';
import { renderApp } from '@/test/render';

const mockCreate = jest.fn().mockResolvedValue(undefined); const mockListByWorkplace = jest.fn().mockResolvedValue([]);
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() }, useFocusEffect: jest.fn() }));
jest.mock('@/features/shifts/hooks/use-repositories', () => ({ useRepositories: () => ({ salaryProfiles: { create: mockCreate, update: jest.fn(), listByWorkplace: mockListByWorkplace } }) }));
jest.mock('@/features/workplaces/hooks/use-workplaces', () => ({ useWorkplaces: () => ({ workplaces: [{ id: 'workplace-1', name: 'קפה העיר' }] }) }));

describe('salary profile form', () => {
  beforeEach(() => { mockCreate.mockClear(); mockListByWorkplace.mockClear(); });
  it('uses Hebrew accessible currency fields and persists exact minor units', async () => {
    renderApp(<SalaryProfilesScreen />);
    const assumptions = screen.getByRole('button', { name: 'איך חושב הסכום?' });
    expect(assumptions.props.accessibilityState).toEqual({ expanded: false });
    fireEvent.press(assumptions);
    expect(screen.getByText('מה עדיין לא מחושב במלואו')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('שם פרופיל'), 'שכר קיץ');
    fireEvent.changeText(screen.getByLabelText('תעריף שעתי'), '58.50');
    fireEvent.press(screen.getByRole('button', { name: 'יצירת פרופיל שכר' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'שכר קיץ', baseHourlyRateMinor: 5850 })));
    await waitFor(() => expect(screen.getByLabelText('שם פרופיל').props.value).toBe(''));
  });
  it('shows validation feedback for an invalid currency value', async () => {
    renderApp(<SalaryProfilesScreen />);
    fireEvent.changeText(screen.getByLabelText('שם פרופיל'), 'שגוי'); fireEvent.changeText(screen.getByLabelText('תעריף שעתי'), '58.501');
    fireEvent.press(screen.getByRole('button', { name: 'יצירת פרופיל שכר' }));
    expect(await screen.findByText('יש לבדוק את הערכים שהוזנו ולנסות שוב.')).toBeTruthy(); expect(mockCreate).not.toHaveBeenCalled();
  });
});
