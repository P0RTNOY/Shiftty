import type { Shift, ShiftStatus } from '@/domain/entities';
import type { ShiftRange } from '@/domain/services/shift-overlap-service';

export interface ShiftQuery {
  startsBefore?: string;
  endsAfter?: string;
  statuses?: readonly ShiftStatus[];
  workplaceId?: string;
  recurrenceGroupId?: string;
  rangeSource?: 'display' | 'salary';
}

export interface ShiftRepository {
  getById(id: string): Promise<Shift | null>;
  findActive(): Promise<Shift | null>;
  list(query?: ShiftQuery): Promise<Shift[]>;
  listUpcoming(after: string, limit?: number): Promise<Shift[]>;
  getNextScheduled(after: string): Promise<Shift | null>;
  findOverlapping(range: ShiftRange, excludeId?: string): Promise<Shift[]>;
  create(shift: Shift): Promise<void>;
  update(shift: Shift): Promise<void>;
  save(shift: Shift): Promise<void>;
  saveMany(shifts: readonly Shift[]): Promise<void>;
  delete(id: string): Promise<void>;
  deleteMany(ids: readonly string[]): Promise<void>;
}
