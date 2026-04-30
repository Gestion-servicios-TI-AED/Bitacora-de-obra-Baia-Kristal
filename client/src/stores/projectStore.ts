import { create } from 'zustand';

// ── SINGLE PROJECT MODE ──
// When true, the app locks to DEFAULT_PROJECT_NAME and hides multi-project UI.
// Set to false to re-enable multi-project support in the future.
export const SINGLE_PROJECT_MODE = true;
export const DEFAULT_PROJECT_NAME = 'Baia Kristal';

interface ProjectStore {
    selectedProjectId: string | null;
    setSelectedProjectId: (id: string | null) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
    selectedProjectId: null,
    setSelectedProjectId: (id) => set({ selectedProjectId: id }),
}));
