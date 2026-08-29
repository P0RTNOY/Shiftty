import { createPayRule } from '@/test/fixtures';

import {
  buildManagedWeeklyRestPayRule,
  classifyWeeklyRestPayRules,
  weeklyRestPayRuleId,
} from '@/domain/services/weekly-rest-pay-rule-service';

const timestamp = '2026-08-29T18:00:00+03:00';

describe('weekly-rest pay-rule helper', () => {
  it('builds a dedicated non-stacking weekly-rest total-rate rule', () => {
    const rule = buildManagedWeeklyRestPayRule({
      salaryProfileId: 'profile-1',
      multiplierBasisPoints: 15_000,
      name: 'תעריף מנוחה שבועית',
      timestamp,
    });

    expect(rule).toMatchObject({
      id: weeklyRestPayRuleId('profile-1'),
      salaryProfileId: 'profile-1',
      conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }],
      effect: { type: 'multiplier', basisPoints: 15_000 },
      premiumFamily: 'special_interval',
      canStack: false,
      isEnabled: true,
    });
  });

  it('updates only its exact managed shape and preserves advanced rules', () => {
    const managed = buildManagedWeeklyRestPayRule({
      salaryProfileId: 'profile-1', multiplierBasisPoints: 15_000, name: 'Rest', timestamp,
    });
    const advanced = createPayRule({
      id: 'advanced-rest', salaryProfileId: 'profile-1', name: 'Agreement override',
      conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest'] }],
      effect: { type: 'multiplier', basisPoints: 17_500 }, premiumFamily: 'special_interval',
    });

    expect(classifyWeeklyRestPayRules([advanced, managed], 'profile-1')).toEqual({
      managed,
      managedIdCollision: undefined,
      advanced: [advanced],
    });
    expect(buildManagedWeeklyRestPayRule({
      salaryProfileId: 'profile-1', multiplierBasisPoints: 16_000, name: 'Ignored',
      timestamp: '2026-08-29T19:00:00+03:00', existing: managed,
    })).toMatchObject({ name: 'Rest', effect: { type: 'multiplier', basisPoints: 16_000 }, createdAt: timestamp });
  });

  it('blocks an incompatible deterministic-ID collision instead of overwriting it', () => {
    const collision = createPayRule({
      id: weeklyRestPayRuleId('profile-1'), salaryProfileId: 'profile-1',
      conditions: [{ type: 'specialInterval', intervalTypes: ['weekly_rest', 'holiday'] }],
      effect: { type: 'multiplier', basisPoints: 15_000 }, premiumFamily: 'special_interval',
    });

    expect(classifyWeeklyRestPayRules([collision], 'profile-1')).toEqual({
      managed: undefined,
      managedIdCollision: collision,
      advanced: [collision],
    });
    expect(() => buildManagedWeeklyRestPayRule({
      salaryProfileId: 'profile-1', multiplierBasisPoints: 15_000, name: 'Rest', timestamp, existing: collision,
    })).toThrow('incompatible rule');
  });

  it('treats a disabled managed rule as advanced instead of silently re-enabling it', () => {
    const disabled = {
      ...buildManagedWeeklyRestPayRule({
        salaryProfileId: 'profile-1', multiplierBasisPoints: 15_000, name: 'Rest', timestamp,
      }),
      isEnabled: false,
    };

    expect(classifyWeeklyRestPayRules([disabled], 'profile-1')).toEqual({
      managed: undefined,
      managedIdCollision: disabled,
      advanced: [disabled],
    });
  });
});
