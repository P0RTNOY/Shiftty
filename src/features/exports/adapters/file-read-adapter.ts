import { File } from 'expo-file-system';

export function readTextFile(uri: string): Promise<string> {
  return new File(uri).text();
}
