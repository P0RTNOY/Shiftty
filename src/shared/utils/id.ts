import * as Crypto from 'expo-crypto';

export function createId(prefix: string): string {
  const uuid = Crypto.randomUUID();
  return `${prefix}-${uuid}`;
}
