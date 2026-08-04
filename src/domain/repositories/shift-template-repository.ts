import type { ShiftTemplate } from '@/domain/entities';

export interface ShiftTemplateRepository {
  list(): Promise<ShiftTemplate[]>;
}
