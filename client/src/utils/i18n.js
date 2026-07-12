import { MUSCLE_LABELS } from '../constants/muscles.js';
import { EQUIPMENT_LABELS } from '../constants/equipment.js';
import { LEVEL_LABELS } from '../constants/levels.js';
import { EXERCISE_NAME_MAP } from '../constants/exerciseNames.js';

export function tMuscle(key) {
  return MUSCLE_LABELS[key] || key || '';
}

export function tEquipment(key) {
  return EQUIPMENT_LABELS[key] || key || '';
}

export function tLevel(key) {
  return LEVEL_LABELS[key] || key || '';
}

export function tExerciseName(id) {
  if (!id) return '';
  return EXERCISE_NAME_MAP[id] || id;
}

export function tMechanic(key) {
  const map = { compound: '复合动作', isolation: '孤立动作' };
  return map[key] || key || '';
}
