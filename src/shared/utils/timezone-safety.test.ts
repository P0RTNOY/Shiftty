import { format } from 'date-fns';
import { resolveLocalShiftRange } from './zoned-time';

describe('Timezone Safety', () => {
  it('proves native picker extraction is immune to timezone drift', () => {
    // 1. Simulate user picking August 10, 12:00 PM local device time.
    // In our tests, the node environment timezone might be UTC.
    // The native picker always constructs a Date where the getters match the UI.
    const nativePickerDate = new Date(2026, 7, 10, 12, 0); // 7 = August

    // 2. We extract using date-fns format (which uses local getters internally)
    const localDateStr = format(nativePickerDate, 'yyyy-MM-dd');
    const localTimeStr = format(nativePickerDate, 'HH:mm');

    // 3. We prove the extracted strings remain exact to what the user tapped
    expect(localDateStr).toBe('2026-08-10');
    expect(localTimeStr).toBe('12:00');

    // 4. We pass it to the domain which authoritatively assigns the App timezone (Asia/Jerusalem)
    const range = resolveLocalShiftRange(localDateStr, localTimeStr, '16:00', 'Asia/Jerusalem');
    
    // In Jerusalem (UTC+3), 12:00 PM local corresponds to 09:00:00Z UTC
    // TZDate returns the ISO string with the +03:00 offset preserved.
    expect(range.start).toBe('2026-08-10T12:00:00.000+03:00');
    expect(new Date(range.start).toISOString()).toBe('2026-08-10T09:00:00.000Z');
  });
});
