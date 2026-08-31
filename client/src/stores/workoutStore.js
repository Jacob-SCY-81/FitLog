import { create } from 'zustand';

const STORAGE_KEY_PREFIX = 'fitlog_draft_';

function getStorageKey(userId) {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

export function loadDraft(userId) {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw);
    // Check schema version and 24h expiry
    if (draft.schemaVersion !== 1) return null;
    if (Date.now() - draft.updatedAt > 24 * 60 * 60 * 1000) return null;
    return draft;
  } catch {
    return null;
  }
}

function saveDraft(userId, data) {
  try {
    const draft = {
      schemaVersion: 1,
      updatedAt: Date.now(),
      exercises: data.exercises || [],
      notes: data.notes || '',
      startTime: data.startTime || null,
    };
    localStorage.setItem(getStorageKey(userId), JSON.stringify(draft));
  } catch {
    // localStorage full or unavailable
  }
}

export function clearDraft(userId) {
  localStorage.removeItem(getStorageKey(userId));
}

export const useWorkoutStore = create((set, get) => ({
  exercises: [],      // { exerciseId, exerciseName, targetMuscle, sets: [...], sortOrder }
  notes: '',
  startTime: null,
  draftLoaded: false,
  draftTime: null,

  initDraft: (userId) => {
    const draft = loadDraft(userId);
    if (draft) {
      set({
        exercises: draft.exercises,
        notes: draft.notes || '',
        startTime: draft.startTime,
        draftLoaded: true,
        draftTime: draft.updatedAt,
      });
      return true; // has draft
    }
    return false;
  },

  addExercise: (exercise, userId) => {
    const state = get();
    const newExercises = [...state.exercises, {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      targetMuscle: exercise.targetMuscle,
      sortOrder: state.exercises.length + 1,
      sets: [{
        setIndex: 1,
        setType: 'standard',
        weight: '',
        reps: '',
        rpe: null,
        isCompleted: false,
        completedAt: null,
        actualRestTimeSec: 0,
      }],
    }];
    set({ exercises: newExercises });
    saveDraft(userId, { ...state, exercises: newExercises });
  },

  removeExercise: (sortOrder, userId) => {
    const state = get();
    const newExercises = state.exercises
      .filter(e => e.sortOrder !== sortOrder)
      .map((e, i) => ({ ...e, sortOrder: i + 1 }));
    set({ exercises: newExercises });
    saveDraft(userId, { ...state, exercises: newExercises });
  },

  addSet: (sortOrder, userId) => {
    const state = get();
    const newExercises = state.exercises.map(ex => {
      if (ex.sortOrder !== sortOrder) return ex;
      return {
        ...ex,
        sets: [...ex.sets, {
          setIndex: ex.sets.length + 1,
          setType: 'standard',
          weight: '',
          reps: '',
          rpe: null,
          isCompleted: false,
          completedAt: null,
          actualRestTimeSec: 0,
        }],
      };
    });
    set({ exercises: newExercises });
    saveDraft(userId, { ...state, exercises: newExercises });
  },

  removeSet: (sortOrder, setIndex, userId) => {
    const state = get();
    const newExercises = state.exercises.map(ex => {
      if (ex.sortOrder !== sortOrder) return ex;
      if (ex.sets.length <= 1) return ex; // keep at least 1 set
      const newSets = ex.sets
        .filter(s => s.setIndex !== setIndex)
        .map((s, i) => ({ ...s, setIndex: i + 1 }));
      return { ...ex, sets: newSets };
    });
    set({ exercises: newExercises });
    saveDraft(userId, { ...state, exercises: newExercises });
  },

  updateSet: (sortOrder, setIndex, field, value, userId) => {
    const state = get();
    const now = new Date().toISOString();
    const newExercises = state.exercises.map(ex => {
      if (ex.sortOrder !== sortOrder) return ex;
      return {
        ...ex,
        sets: ex.sets.map(s => {
          if (s.setIndex !== setIndex) return s;
          const updated = { ...s, [field]: value };
          // Auto-set completedAt when marking complete
          if (field === 'isCompleted' && value && !s.completedAt) {
            updated.completedAt = now;
          }
          if (field === 'isCompleted' && !value) {
            updated.completedAt = null;
          }
          return updated;
        }),
      };
    });
    set({ exercises: newExercises });
    // Debounced save
    if (get()._saveTimer) clearTimeout(get()._saveTimer);
    const timer = setTimeout(() => saveDraft(userId, { ...state, exercises: newExercises }), 500);
    set({ _saveTimer: timer });
  },

  setNotes: (notes, userId) => {
    const state = get();
    set({ notes });
    if (get()._saveTimer) clearTimeout(get()._saveTimer);
    const timer = setTimeout(() => saveDraft(userId, { ...state, notes }), 500);
    set({ _saveTimer: timer });
  },

  clearDraft: (userId) => {
    clearDraft(userId);
    set({ exercises: [], notes: '', startTime: null, draftLoaded: false, draftTime: null });
  },

  discardDraft: (userId) => {
    clearDraft(userId);
    set({ draftLoaded: false, draftTime: null });
  },
}));
