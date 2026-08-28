describe('Milestone 7 native evidence gate', () => {
  const originalFlag = process.env.EXPO_PUBLIC_M7_NATIVE_EVIDENCE;
  const originalBundleIdentifier = process.env.EXPO_PUBLIC_M7_NATIVE_EVIDENCE_BUNDLE_ID;

  afterEach(() => {
    process.env.EXPO_PUBLIC_M7_NATIVE_EVIDENCE = originalFlag;
    process.env.EXPO_PUBLIC_M7_NATIVE_EVIDENCE_BUNDLE_ID = originalBundleIdentifier;
    jest.resetModules();
  });

  function loadGate(bundleIdentifier: string | undefined): typeof import('./m7-native-evidence') {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { ios: { bundleIdentifier } } },
    }));
    let module: typeof import('./m7-native-evidence') | undefined;
    jest.isolateModules(() => {
      module = jest.requireActual<typeof import('./m7-native-evidence')>('./m7-native-evidence');
    });
    return module!;
  }

  it('enables diagnostics only for matching explicit QA build inputs', () => {
    process.env.EXPO_PUBLIC_M7_NATIVE_EVIDENCE = '1';
    process.env.EXPO_PUBLIC_M7_NATIVE_EVIDENCE_BUNDLE_ID = 'com.example.shiftty.qa';
    const { isM7NativeEvidenceEnabled } = loadGate('com.example.shiftty.qa');
    expect(isM7NativeEvidenceEnabled()).toBe(true);
  });

  it.each([
    [undefined, 'com.example.shiftty.qa', 'com.example.shiftty.qa'],
    ['0', 'com.example.shiftty.qa', 'com.example.shiftty.qa'],
    ['1', undefined, 'com.example.shiftty.qa'],
    ['1', '', 'com.example.shiftty.qa'],
    ['1', 'com.example.shiftty.other', 'com.example.shiftty.qa'],
    ['1', 'com.omerportnoy.shifty', 'com.omerportnoy.shifty'],
  ])('fails closed for flag %p, expected bundle %p, and actual bundle %p', (flag, expectedBundleIdentifier, bundleIdentifier) => {
    process.env.EXPO_PUBLIC_M7_NATIVE_EVIDENCE = flag;
    process.env.EXPO_PUBLIC_M7_NATIVE_EVIDENCE_BUNDLE_ID = expectedBundleIdentifier;
    const { isM7NativeEvidenceEnabled } = loadGate(bundleIdentifier);
    expect(isM7NativeEvidenceEnabled()).toBe(false);
  });
});

describe('Milestone 7 native evidence privacy projection', () => {
  it('returns only the owner-matched count', () => {
    const { countOwnedNotifications } = jest.requireActual<typeof import('./m7-native-evidence')>('./m7-native-evidence');
    const notifications = [
      { content: { data: { owner: 'shifty', shiftId: 'private-shift-id' } } },
      { content: { data: { owner: 'other', body: 'private body' } } },
      { content: { data: { owner: 'shifty', logicalKey: 'private-logical-key' } } },
    ];
    expect(countOwnedNotifications(notifications)).toBe(2);
  });

  it('cancels native requests before deleting QA shifts and reconciling', async () => {
    const { cleanupM7QaShifts } = jest.requireActual<typeof import('./m7-native-evidence')>('./m7-native-evidence');
    const calls: string[] = [];

    await cleanupM7QaShifts(['qa-1', 'qa-2'], {
      cancelForShift: async (shiftId) => { calls.push(`cancel:${shiftId}`); },
      deleteMany: async (shiftIds) => { calls.push(`delete:${shiftIds.join(',')}`); },
      reconcile: async () => { calls.push('reconcile'); },
    });

    expect(calls).toEqual(['cancel:qa-1', 'cancel:qa-2', 'delete:qa-1,qa-2', 'reconcile']);
  });
});
