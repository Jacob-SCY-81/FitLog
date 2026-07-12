import prisma from '../../lib/prisma.js';

/**
 * List body measurements (paginated, newest first).
 */
export async function listMeasurements({ page, limit }, userId) {
  const where = { userId };

  const [data, total] = await Promise.all([
    prisma.bodyMeasurement.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { date: 'desc' },
    }),
    prisma.bodyMeasurement.count({ where }),
  ]);

  return { data, total, page, limit };
}

/**
 * Create a body measurement entry.
 */
export async function createMeasurement(data, userId) {
  const measurement = await prisma.bodyMeasurement.create({
    data: {
      userId,
      date: data.date ? new Date(data.date) : new Date(),
      weightKg: data.weightKg ?? null,
      bodyFatPct: data.bodyFatPct ?? null,
      chestCm: data.chestCm ?? null,
      waistCm: data.waistCm ?? null,
      hipCm: data.hipCm ?? null,
      armCm: data.armCm ?? null,
      thighCm: data.thighCm ?? null,
      notes: data.notes || null,
    },
  });
  return measurement;
}

/**
 * Delete a measurement.
 */
export async function deleteMeasurement(id, userId) {
  const m = await prisma.bodyMeasurement.findUnique({ where: { id } });
  if (!m) {
    const err = new Error('Measurement not found.');
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }
  if (m.userId !== userId) {
    const err = new Error('Forbidden.');
    err.statusCode = 403;
    err.errorCode = 'FORBIDDEN';
    throw err;
  }
  await prisma.bodyMeasurement.delete({ where: { id } });
}

/**
 * Get weight trend data for charts.
 */
export async function getWeightTrend(userId, days = 90) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const measurements = await prisma.bodyMeasurement.findMany({
    where: {
      userId,
      date: { gte: since },
      weightKg: { not: null },
    },
    select: { date: true, weightKg: true },
    orderBy: { date: 'asc' },
  });

  return measurements.map(m => ({
    date: m.date.toISOString().split('T')[0],
    weight: m.weightKg,
  }));
}
