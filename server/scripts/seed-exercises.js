import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const inputPath = path.join(__dirname, '..', '..', 'data', 'exercises.json');

async function seed() {
  console.log('Reading converted exercises.json...');
  const rawData = fs.readFileSync(inputPath, 'utf8');
  const exercises = JSON.parse(rawData);

  // Soft delete old official exercises that are NOT in the new list
  const newIds = exercises.map(ex => ex.id);
  const deleteResult = await prisma.exercise.updateMany({
    where: {
      isOfficial: true,
      id: { notIn: newIds }
    },
    data: { deletedAt: new Date() }
  });
  console.log(`Soft deleted ${deleteResult.count} deprecated official exercises.`);

  console.log('Upserting exercises...');
  const dataToInsert = exercises.map(ex => ({
    id: ex.id,
    name: ex.name,
    targetMuscle: ex.targetMuscle,
    equipment: ex.equipment,
    mediaUrl: ex.images && ex.images.length > 0 ? ex.images[0] : null,
    isOfficial: true,
  }));

  // Perform upserts in a batch transaction or sequential loop
  let upsertedCount = 0;
  for (const ex of dataToInsert) {
    await prisma.exercise.upsert({
      where: { id: ex.id },
      update: {
        name: ex.name,
        targetMuscle: ex.targetMuscle,
        equipment: ex.equipment,
        mediaUrl: ex.mediaUrl,
        deletedAt: null,
        isOfficial: true,
      },
      create: ex,
    });
    upsertedCount++;
  }
  
  console.log(`Successfully upserted ${upsertedCount} exercises.`);
}

seed()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
