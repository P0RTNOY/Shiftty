# Native Maestro journeys

These flows exercise only public production UI and the app's real SQLite repositories. `clearState` resets the selected simulator/emulator app container, so run the suite only against a disposable development build. There is no fixture route, seeded database, hidden clock, or production bypass.

## Run

iOS uses the stable legacy bundle identifier:

```bash
MAESTRO_CLI_NO_ANALYTICS=1 maestro test -e APP_ID=com.omerportnoy.shifty .maestro/journeys
```

Android uses:

```bash
MAESTRO_CLI_NO_ANALYTICS=1 maestro test --exclude-tags ios -e APP_ID=com.shifty.app -e WEEKLY_DATE_1=YYYY-MM-DD -e WEEKLY_DATE_2=YYYY-MM-DD .maestro/journeys
```

The two Android weekly dates must be consecutive local dates in the same workweek and on or after the profile version's selected effective date. For release evidence, run each Android journey in a fresh Maestro process so a long-lived device-server timeout cannot invalidate an unrelated later flow. Run one journey while developing with the same environment arguments. The suite assumes the app is already installed and can launch without a disconnected development server.

## Coverage boundary

- A completes fresh onboarding, cold-relaunches, and confirms the persisted workplace remains available.
- B starts a real shift and unpaid break, cold-relaunches, verifies both restore, completes the shift, and finds it on Home, Calendar, and Reports.
- C creates a 150% shift type with a copied break duration, overrides the copied break on a scheduled shift, archives the type, and verifies the shift still presents its snapshotted type identity.
- D has separate iOS and Android flows. Each saves a versioned profile with an eight-hour weekly threshold, creates deterministic eight-hour shifts on consecutive effective-profile workweek dates, proves the first has no overtime segment, and verifies the later shift has exactly eight hours at 150% with no duplicate default-overtime segment. It also opens the assumptions disclosure. The Android flow asserts the exact numeric field before save.
- E accepts the dated 2026 evidence preset, creates an unaffected control shift and an overlapping completed shift before any matching rule, and verifies evidence alone has no pay effect. It adds the 150% rule, explicitly recalculates the affected shift, edits the evidence, verifies the control remains current and the affected shift becomes stale, and confirms the stale view retains the original frozen evidence name. Its four-month report navigation is intentionally tied to this dated fixture.
- F has separate iOS and Android flows. Each completes a real finalized-zero shift, asserts the report's estimated total, generates PDF/CSV/calendar-only ICS through native share UI, and exports a backup through native share UI. It verifies the restore entry point but does not select and restore a file through the OS document picker.
- G is Android-tagged. It exercises the real notification permission prompt, enables one scheduled-shift reminder offset, disables the other default offsets, and verifies the remaining notification controls.

Native share presentation is automated on iOS and Android, but selecting a share target is intentionally outside the journey. File-content readback, document-picker restore, delivered-notification states, and locale/device appearance changes remain separate native checks. Domain and integration tests remain authoritative for generated file contents, restore semantics, SQLite integrity, and numeric invariants; the Maestro flows verify the native actions and user-visible salary state transitions.
