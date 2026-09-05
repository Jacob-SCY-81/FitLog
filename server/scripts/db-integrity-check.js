import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkIntegrity() {
  try {
    const userCount = await prisma.user.count();
    const workoutCount = await prisma.workoutRecord.count();
    const exerciseSetCount = await prisma.exerciseSet.count();
    const templateCount = await prisma.workoutTemplate.count();
    const favoriteCount = await prisma.favoriteExercise.count();
    const measurementCount = await prisma.bodyMeasurement.count();
    const refreshTokenCount = await prisma.refreshToken.count();
    const exerciseCount = await prisma.exercise.count();

    const emailRes = await prisma.$queryRawUnsafe("SELECT COUNT(*) as count FROM `User` WHERE `email` IS NOT NULL");
    const emailNotNullCount = Number(emailRes[0]?.count || 0);

    // 探测数据库物理表结构是否已有 phone 字段
    const phoneColumns = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM `User` LIKE 'phone'");
    const phoneColumnExists = Array.isArray(phoneColumns) && phoneColumns.length > 0;

    let phoneNotNullCount = 0;
    if (phoneColumnExists) {
      const res = await prisma.$queryRawUnsafe("SELECT COUNT(*) as count FROM `User` WHERE `phone` IS NOT NULL");
      phoneNotNullCount = Number(res[0]?.count || 0);
    }

    console.log('=== Database Baseline Statistics ===');
    console.log(`User:              ${userCount}`);
    console.log(`WorkoutRecord:     ${workoutCount}`);
    console.log(`ExerciseSet:       ${exerciseSetCount}`);
    console.log(`WorkoutTemplate:   ${templateCount}`);
    console.log(`FavoriteExercise:  ${favoriteCount}`);
    console.log(`BodyMeasurement:   ${measurementCount}`);
    console.log(`RefreshToken:      ${refreshTokenCount}`);
    console.log(`Exercise:          ${exerciseCount}`);
    console.log('--- User Field Status ---');
    console.log(`User.email NOT NULL: ${emailNotNullCount}`);
    console.log(`User.phone Column Exists: ${phoneColumnExists}`);
    console.log(`User.phone NOT NULL: ${phoneNotNullCount}`);

    const userDesc = await prisma.$queryRawUnsafe("DESCRIBE `User`");
    console.log('--- User Columns ---');
    console.table(userDesc.filter(c => ['id', 'phone', 'phoneVerifiedAt', 'email'].includes(c.Field)));

    const phoneIndex = await prisma.$queryRawUnsafe("SHOW INDEX FROM `User` WHERE Column_name = 'phone'");
    console.log('--- Phone Index ---');
    console.table(phoneIndex.map(i => ({ Key_name: i.Key_name, Column_name: i.Column_name, Non_unique: i.Non_unique })));

    return {
      userCount,
      workoutCount,
      exerciseSetCount,
      templateCount,
      favoriteCount,
      measurementCount,
      refreshTokenCount,
      exerciseCount,
      emailNotNullCount,
      phoneColumnExists,
      phoneNotNullCount,
    };
  } catch (err) {
    console.error('统计失败:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkIntegrity();
