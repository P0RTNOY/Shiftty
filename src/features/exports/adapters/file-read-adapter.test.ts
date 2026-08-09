import * as FileSystem from 'expo-file-system';

import { readTextFile } from './file-read-adapter';

const mockText = jest.fn().mockResolvedValue('{"ok":true}');

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri) => ({ uri, text: mockText })),
}));

describe('file-read-adapter', () => {
  it('reads a selected document with the current File API', async () => {
    await expect(readTextFile('file:///mock/backup.json')).resolves.toBe('{"ok":true}');
    expect(FileSystem.File).toHaveBeenCalledWith('file:///mock/backup.json');
    expect(mockText).toHaveBeenCalledTimes(1);
  });
});
