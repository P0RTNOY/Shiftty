import { create } from 'zustand';

import type { Shift } from '@/domain/entities';
import type { ShiftRepository } from '@/domain/repositories';
import { restoreActiveShift } from '@/domain/services';

type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AppState {
  bootstrapStatus: BootstrapStatus;
  bootstrapError: string | null;
  activeShift: Shift | null;
  bootstrap: (repository: ShiftRepository) => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  bootstrapStatus: 'idle',
  bootstrapError: null,
  activeShift: null,
  async bootstrap(repository) {
    set({ bootstrapStatus: 'loading', bootstrapError: null });
    try {
      const activeShift = await restoreActiveShift(repository);
      set({ activeShift, bootstrapStatus: 'ready' });
    } catch (error) {
      set({
        bootstrapStatus: 'error',
        bootstrapError: error instanceof Error ? error.message : String(error),
      });
    }
  },
}));
