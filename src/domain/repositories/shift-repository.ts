import type { Shift, ShiftStatus } from '@/domain/entities';

export interface ShiftQuery {
  startsBefore?: string;
  endsAfter?: string;
  statuses?: readonly ShiftStatus[];
  workplaceId?: string;
}

export interface ShiftRepository {
  getById(id: string): Promise<Shift | null>;
  findActive(): Promise<Shift | null>;
  list(query?: ShiftQuery): Promise<Shift[]>;
  save(shift: Shift): Promise<void>;
  delete(id: string): Promise<void>;
}
