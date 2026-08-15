import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import DataManagementScreen from '@/app/settings/data-management';
import { renderApp } from '@/test/render';

const mockGetDocumentAsync = jest.fn();
const mockReadTextFile = jest.fn();
const mockValidateBackup = jest.fn();

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args) }));
jest.mock('@/features/exports/adapters/file-read-adapter', () => ({ readTextFile: (...args: unknown[]) => mockReadTextFile(...args) }));
jest.mock('@/domain/services/backup-orchestrator', () => ({
  BackupOrchestrator: jest.fn().mockImplementation(() => ({ validateBackup: (...args: unknown[]) => mockValidateBackup(...args) })),
}));
jest.mock('@/features/settings/store/app-store', () => ({
  useAppStore: (selector: (state: { setActiveShift: jest.Mock }) => unknown) => selector({ setActiveShift: jest.fn() }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///backup.json' }] });
  mockReadTextFile.mockResolvedValue('{}');
  mockValidateBackup.mockResolvedValue({ valid: true, envelope: { counts: { shifts: 3 } } });
});

it('uses clear Hebrew choices for merging or replacing a backup', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  renderApp(<DataManagementScreen />);

  expect(screen.getByText('ייבוא מתוך קובץ גיבוי של Shiftty. לאחר בחירת הקובץ אפשר למזג אותו עם הנתונים הקיימים או להחליף אותם.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'בחר קובץ לשחזור' }));

  await waitFor(() => expect(alert).toHaveBeenCalledWith(
    'שחזור נתונים',
    expect.stringContaining('3 משמרות'),
    expect.arrayContaining([
      expect.objectContaining({ text: 'מיזוג עם הקיים' }),
      expect.objectContaining({ text: 'החלפת כל הנתונים' }),
    ]),
  ));
});
