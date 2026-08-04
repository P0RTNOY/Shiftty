import type { ShiftTemplate } from '@/domain/entities';

export interface CreateShiftTemplateInput {
  name: string;
  defaultStartTime: string;
  defaultEndTime: string;
  expectedBreakMinutes: number;
  expectedBreakType?: 'paid' | 'unpaid';
  validWeekdays?: number[];
  expectedDurationMinutes?: number;
  colorToken?: string;
  workplaceId?: string;
  roleId?: string;
  salaryProfileId?: string;
}

export type UpdateShiftTemplateInput = Partial<CreateShiftTemplateInput>;

export interface ShiftTemplateRepository {
  list(): Promise<ShiftTemplate[]>;
  listActive(): Promise<ShiftTemplate[]>;
  listIncludingArchived(): Promise<ShiftTemplate[]>;
  getById(id: string): Promise<ShiftTemplate | null>;
  create(input: CreateShiftTemplateInput): Promise<ShiftTemplate>;
  update(id: string, input: UpdateShiftTemplateInput): Promise<ShiftTemplate>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  duplicate(id: string, newName: string): Promise<ShiftTemplate>;
}
