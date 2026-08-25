import { Text } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { DatabaseRecoveryBoundary } from '@/features/settings/components/database-recovery-boundary';
import { renderApp } from '@/test/render';

const mockShareStartupDiagnostic = jest.fn();

jest.mock('@/features/settings/services/startup-diagnostic-service', () => ({
  shareStartupDiagnostic: (...args: unknown[]) => mockShareStartupDiagnostic(...args),
}));

it('shows recovery guidance, exports a safe diagnostic, and can retry', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  mockShareStartupDiagnostic.mockResolvedValue(undefined);
  let shouldFail = true;
  function DatabaseChild() {
    if (shouldFail) {
      throw new Error('sensitive native database detail');
    }
    return <Text>database ready</Text>;
  }

  try {
    renderApp(
      <DatabaseRecoveryBoundary>
        <DatabaseChild />
      </DatabaseRecoveryBoundary>,
    );

    expect(screen.getByTestId('database-recovery-screen')).toBeTruthy();
    expect(screen.getByText(/אין למחוק את האפליקציה או את הנתונים שלה/)).toBeTruthy();
    expect(screen.queryByText(/sensitive native database detail/)).toBeNull();
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('sensitive native database detail');

    fireEvent.press(screen.getByTestId('export-startup-diagnostic'));
    await waitFor(() => expect(mockShareStartupDiagnostic).toHaveBeenCalledWith(
      'Error',
      'אבחון הפעלה של שיפטי',
    ));

    shouldFail = false;
    fireEvent.press(screen.getByRole('button', { name: 'ניסיון נוסף' }));
    expect(screen.getByText('database ready')).toBeTruthy();
  } finally {
    consoleError.mockRestore();
  }
});
