import type { SQLiteDatabase } from 'expo-sqlite';
import { SqlitePredictionFeedbackRepository } from '@/data/repositories/sqlite-prediction-feedback-repository';

it('records and lists prediction feedback', async () => {
  const db = {
    getAllAsync: jest.fn(),
    runAsync: jest.fn(),
  };
  const repo = new SqlitePredictionFeedbackRepository(db as unknown as SQLiteDatabase);

  // record
  db.runAsync.mockResolvedValueOnce(undefined);
  await repo.record({
    feedbackType: 'accepted_all',
    engineVersion: 'v1',
    candidateSource: 'template',
    candidateSourceId: 'tmpl-1',
    score: 85,
    acceptedFields: ['scheduledStart', 'scheduledEnd'],
    rejectedFields: [],
  });

  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO prediction_feedback'),
    expect.arrayContaining(['accepted_all', 'v1', 'template', 'tmpl-1', 85, '["scheduledStart","scheduledEnd"]', '[]'])
  );

  // list
  db.getAllAsync.mockResolvedValueOnce([{
    id: 'f-1',
    feedback_type: 'accepted_partial',
    engine_version: 'v1',
    candidate_source: 'historical_pattern',
    candidate_source_id: 'hist-1',
    score: 60,
    accepted_fields_json: '["scheduledStart"]',
    rejected_fields_json: '["scheduledEnd"]',
    created_at: '2026-01-01T00:00:00Z',
  }]);

  const list = await repo.listRecent(10);
  expect(db.getAllAsync).toHaveBeenCalledWith(
    expect.stringContaining('ORDER BY created_at DESC LIMIT ?'),
    [10]
  );
  expect(list).toHaveLength(1);
  expect(list[0]?.feedbackType).toBe('accepted_partial');
  expect(list[0]?.acceptedFields).toEqual(['scheduledStart']);
  expect(list[0]?.rejectedFields).toEqual(['scheduledEnd']);

  // clear
  db.runAsync.mockResolvedValueOnce(undefined);
  await repo.clearAll();
  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining('DELETE FROM prediction_feedback;')
  );
});
