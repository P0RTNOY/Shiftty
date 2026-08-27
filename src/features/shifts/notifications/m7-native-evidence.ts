import Constants from 'expo-constants';

const PRODUCTION_IOS_BUNDLE_IDENTIFIER = 'com.omerportnoy.shifty';

interface NotificationWithOwner {
  content: {
    data?: Record<string, unknown> | null;
  };
}

export function isM7NativeEvidenceEnabled(): boolean {
  const actualBundleIdentifier = Constants.expoConfig?.ios?.bundleIdentifier;
  const expectedQaBundleIdentifier = process.env.EXPO_PUBLIC_M7_NATIVE_EVIDENCE_BUNDLE_ID;

  return process.env.EXPO_PUBLIC_M7_NATIVE_EVIDENCE === '1'
    && typeof expectedQaBundleIdentifier === 'string'
    && expectedQaBundleIdentifier.length > 0
    && actualBundleIdentifier === expectedQaBundleIdentifier
    && actualBundleIdentifier !== PRODUCTION_IOS_BUNDLE_IDENTIFIER;
}

export function countOwnedNotifications(
  notifications: readonly NotificationWithOwner[],
  owner = 'shifty',
): number {
  return notifications.filter((notification) => notification.content.data?.owner === owner).length;
}
