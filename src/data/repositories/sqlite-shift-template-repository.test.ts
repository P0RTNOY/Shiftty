import type { SQLiteDatabase } from 'expo-sqlite';

import { SqliteShiftTemplateRepository } from '@/data/repositories/sqlite-shift-template-repository';

it('maps persisted shift templates for the scheduling form', async () => {
  const database = { getAllAsync: jest.fn().mockResolvedValue([{
    id: 'morning', name: 'בוקר', default_start_time: '06:00', default_end_time: '14:00',
    expected_break_minutes: 30, workplace_id: 'work-1', role_id: null, salary_profile_id: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }]) };
  const repository = new SqliteShiftTemplateRepository(database as unknown as SQLiteDatabase);
  await expect(repository.list()).resolves.toEqual([expect.objectContaining({ id: 'morning', defaultStartTime: '06:00', workplaceId: 'work-1' })]);
});
