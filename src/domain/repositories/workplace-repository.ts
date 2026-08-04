import type { Role, Workplace } from '@/domain/entities';

export interface WorkplaceRepository {
  list(): Promise<Workplace[]>;
  getById(id: string): Promise<Workplace | null>;
  save(workplace: Workplace): Promise<void>;
  listRoles(workplaceId: string): Promise<Role[]>;
  saveRole(role: Role): Promise<void>;
}
