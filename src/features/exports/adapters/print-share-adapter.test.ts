import { processPdf } from './print-share-adapter';
import * as Print from 'expo-print';

jest.mock('expo-print', () => ({
  printAsync: jest.fn(),
  printToFileAsync: jest.fn()
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' }
}));

describe('print-share-adapter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('calls Print.printAsync with html when action is print', async () => {
    (Print.printAsync as jest.Mock).mockResolvedValue({});
    await processPdf({ html: '<html><body>Test</body></html>', filename: 'test.pdf', action: 'print' });
    expect(Print.printAsync).toHaveBeenCalledWith({
      html: '<html><body>Test</body></html>'
    });
  });

  it('throws error if printAsync throws', async () => {
    (Print.printAsync as jest.Mock).mockRejectedValue(new Error('Print failed'));
    await expect(processPdf({ html: '<html><body>Test</body></html>', filename: 'test.pdf', action: 'print' })).rejects.toThrow('Print failed');
  });
});
