import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EXERCISE_NAME_MAP } from '../../client/src/constants/exerciseNames.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Support source path from D:\GitHubJob\exercises-dataset-main or local fallback
let inputPath = 'D:/GitHubJob/exercises-dataset-main/data/exercises.json';
if (!fs.existsSync(inputPath)) {
  inputPath = path.join(__dirname, '..', '..', 'scratch', 'exercises-dataset', 'data', 'exercises.json');
}

const outputPath = path.join(__dirname, '..', '..', 'data', 'exercises.json');

console.log(`Reading dataset from: ${inputPath}`);
const rawData = fs.readFileSync(inputPath, 'utf8');
const exercises = JSON.parse(rawData);

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const converted = exercises.map((ex) => {
  // Translate exercise name to Chinese if mapping exists, fallback to capitalized English
  const chineseName = EXERCISE_NAME_MAP[ex.id] || capitalize(ex.name);
  
  // Extract instructions (prefer zh steps over en steps)
  let instructions = [];
  if (ex.instruction_steps && Array.isArray(ex.instruction_steps.zh) && ex.instruction_steps.zh.length > 0) {
    instructions = ex.instruction_steps.zh;
  } else if (ex.instruction_steps && Array.isArray(ex.instruction_steps.en) && ex.instruction_steps.en.length > 0) {
    instructions = ex.instruction_steps.en;
  } else if (ex.instructions && ex.instructions.zh) {
    instructions = [ex.instructions.zh];
  } else if (ex.instructions && ex.instructions.en) {
    instructions = [ex.instructions.en];
  }

  // Map images to /media/exercises-dataset/<filename>
  const images = [];
  const rawBase = "/media/exercises-dataset/";
  const mediaRef = ex.gif_url || ex.image;
  if (mediaRef) {
    const filename = path.basename(mediaRef);
    images.push(rawBase + filename);
  }

  const primaryMuscles = Array.from(new Set([ex.target, ex.muscle_group].filter(Boolean)));
  
  return {
    id: ex.id,
    name: chineseName,
    targetMuscle: ex.body_part || 'other',
    primaryMuscles: primaryMuscles,
    secondaryMuscles: ex.secondary_muscles || [],
    equipment: ex.equipment || 'body weight',
    level: 'intermediate',
    category: ex.category || 'other',
    instructions: instructions,
    images: images,
    imageCount: images.length
  };
});

fs.writeFileSync(outputPath, JSON.stringify(converted, null, 2), 'utf8');
console.log(`Successfully converted ${converted.length} exercises. Output saved to: ${outputPath}`);

