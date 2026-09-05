import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function verify() {
  console.log('=== FitLog 动作库基线封口全面核验 ===\n');

  // 1. 读取 exercises.json
  const jsonPath = path.join(__dirname, '..', '..', 'data', 'exercises.json');
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const exercises = JSON.parse(raw);
  const jsonCount = exercises.length;

  // 2. 数据库读取 active official
  const dbActiveOfficial = await prisma.exercise.findMany({
    where: { isOfficial: true, deletedAt: null },
    select: { id: true, name: true, targetMuscle: true, equipment: true, mediaUrl: true },
  });
  const dbActiveOfficialCount = dbActiveOfficial.length;

  // 3. ID 完整一致性比对
  const jsonMap = new Map(exercises.map(e => [e.id, e]));
  let idMismatch = 0;
  let nameMismatch = 0;
  let mediaMismatch = 0;
  let instructionMissing = 0;

  for (const dbEx of dbActiveOfficial) {
    const jsonEx = jsonMap.get(dbEx.id);
    if (!jsonEx) {
      idMismatch++;
    } else {
      if (dbEx.name !== jsonEx.name) nameMismatch++;
      if (dbEx.mediaUrl !== (jsonEx.images?.[0] || null)) mediaMismatch++;
      if (!jsonEx.instructions || jsonEx.instructions.length === 0) instructionMissing++;
    }
  }

  // 4. 多媒体物理文件存在性核验
  const mediaDir = path.join(__dirname, '..', '..', 'data', 'exercises-media');
  let mediaPhysicalMissing = 0;
  let mediaPhysicalFound = 0;

  for (const ex of exercises) {
    if (ex.images && ex.images.length > 0) {
      for (const imgUrl of ex.images) {
        const filename = path.basename(imgUrl);
        const diskPath = path.join(mediaDir, filename);
        if (fs.existsSync(diskPath)) {
          mediaPhysicalFound++;
        } else {
          mediaPhysicalMissing++;
        }
      }
    }
  }

  // 5. 官方动作 soft delete 状态核验
  const dbDeletedOfficialCount = await prisma.exercise.count({
    where: { isOfficial: true, NOT: { deletedAt: null } },
  });

  // 6. 自定义动作状态
  const activeCustomCount = await prisma.exercise.count({
    where: { isOfficial: false, deletedAt: null },
  });
  const deletedCustomCount = await prisma.exercise.count({
    where: { isOfficial: false, NOT: { deletedAt: null } },
  });

  // 7. 历史 Workout 引用检查
  const historicalSets = await prisma.exerciseSet.findMany({
    select: {
      id: true,
      workoutRecordId: true,
      exerciseId: true,
      exercise: {
        select: { id: true, name: true, isOfficial: true, deletedAt: true },
      },
    },
  });

  const brokenReferences = historicalSets.filter(s => !s.exercise);

  const report = {
    dataset: {
      jsonCount,
      dbActiveOfficialCount,
      countsMatch: jsonCount === dbActiveOfficialCount,
      idMismatch,
      nameMismatch,
      mediaMismatch,
      instructionMissing,
    },
    media: {
      physicalFound: mediaPhysicalFound,
      physicalMissing: mediaPhysicalMissing,
      allFound: mediaPhysicalMissing === 0,
    },
    softDelete: {
      deprecatedOfficialInDB: dbDeletedOfficialCount,
      softDeletePreserved: dbDeletedOfficialCount > 0,
    },
    customExercises: {
      activeCustom: activeCustomCount,
      deletedCustom: deletedCustomCount,
      intact: activeCustomCount > 0,
    },
    historicalWorkouts: {
      totalHistoricalSets: historicalSets.length,
      brokenReferences: brokenReferences.length,
      referencesIntact: brokenReferences.length === 0,
      sampleSets: historicalSets.map(s => ({
        setId: s.id,
        exerciseId: s.exerciseId,
        exerciseName: s.exercise?.name,
        isOfficial: s.exercise?.isOfficial,
        isSoftDeleted: !!s.exercise?.deletedAt,
      })),
    },
  };

  console.log(JSON.stringify(report, null, 2));

  const allPass =
    report.dataset.countsMatch &&
    report.dataset.idMismatch === 0 &&
    report.media.allFound &&
    report.historicalWorkouts.referencesIntact;

  console.log('\n基线封口核验最终判定:', allPass ? 'PASS ✅' : 'FAIL ❌');
}

verify()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
