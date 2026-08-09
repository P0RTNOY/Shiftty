import { shareFile } from './file-share-adapter';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const mockWrite = jest.fn();

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((_directory, filename) => ({
    uri: `file:///mock/cache/${filename}`,
    write: mockWrite,
  })),
  Paths: { cache: { uri: 'file:///mock/cache/' } },
  EncodingType: { UTF8: 'utf8', Base64: 'base64' }
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn()
}));

describe('file-share-adapter', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('writes and shares a file', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    await shareFile({ filename: 'test.csv', mimeType: 'text/csv', content: 'a,b,c' });
    expect(FileSystem.File).toHaveBeenCalledWith(FileSystem.Paths.cache, 'test.csv');
    expect(mockWrite).toHaveBeenCalledWith('a,b,c', { encoding: FileSystem.EncodingType.UTF8 });
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///mock/cache/test.csv', expect.objectContaining({ mimeType: 'text/csv' }));
  });

  it('fails gracefully if sharing is unavailable', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    await expect(shareFile({ filename: 'test.csv', mimeType: 'text/csv', content: 'a,b,c' })).rejects.toThrow('Sharing is not available on this device');
  });

  it('fails gracefully if write fails', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    mockWrite.mockImplementationOnce(() => { throw new Error('Write failed'); });
    await expect(shareFile({ filename: 'test.csv', mimeType: 'text/csv', content: 'a,b,c' })).rejects.toThrow('Write failed');
  });
});
