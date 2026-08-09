import { shareFile } from './file-share-adapter';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock/doc/dir/',
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' }
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn()
}));

describe('file-share-adapter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('writes and shares a file', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    await shareFile({ filename: 'test.csv', mimeType: 'text/csv', content: 'a,b,c' });
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('test.csv'),
      'a,b,c',
      { encoding: FileSystem.EncodingType.UTF8 }
    );
    expect(Sharing.shareAsync).toHaveBeenCalled();
  });

  it('fails gracefully if sharing is unavailable', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    await expect(shareFile({ filename: 'test.csv', mimeType: 'text/csv', content: 'a,b,c' })).rejects.toThrow('Sharing is not available on this device');
  });

  it('fails gracefully if write fails', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(new Error('Write failed'));
    await expect(shareFile({ filename: 'test.csv', mimeType: 'text/csv', content: 'a,b,c' })).rejects.toThrow('Write failed');
  });
});
