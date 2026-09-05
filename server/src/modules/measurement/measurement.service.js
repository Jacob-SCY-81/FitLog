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
 * Update an existing measurement entry.
 */
export async function updateMeasurement(id, data, userId) {
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

  const updated = await prisma.bodyMeasurement.update({
    where: { id },
    data: {
      ...(data.date !== undefined && { date: new Date(data.date) }),
      ...(data.weightKg !== undefined && { weightKg: data.weightKg ?? null }),
      ...(data.bodyFatPct !== undefined && { bodyFatPct: data.bodyFatPct ?? null }),
      ...(data.chestCm !== undefined && { chestCm: data.chestCm ?? null }),
      ...(data.waistCm !== undefined && { waistCm: data.waistCm ?? null }),
      ...(data.hipCm !== undefined && { hipCm: data.hipCm ?? null }),
      ...(data.armCm !== undefined && { armCm: data.armCm ?? null }),
      ...(data.thighCm !== undefined && { thighCm: data.thighCm ?? null }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });

  return updated;
}

/**
 * Get the latest body measurement record.
 */
export async function getLatestMeasurement(userId) {
  const latest = await prisma.bodyMeasurement.findFirst({
    where: { userId },
    orderBy: { date: 'desc' },
  });
  return latest;
}

const METRIC_FIELD_MAP = {
  weight: 'weightKg',
  bodyFat: 'bodyFatPct',
  chest: 'chestCm',
  waist: 'waistCm',
  hip: 'hipCm',
  arm: 'armCm',
  thigh: 'thighCm',
};

/**
 * Get multi-metric trend data for charts.
 */
export async function getMeasurementTrend(userId, metric = 'weight', days = 90) {
  const fieldName = METRIC_FIELD_MAP[metric] || 'weightKg';
  const since = new Date();
  since.setDate(since.getDate() - days);

  const measurements = await prisma.bodyMeasurement.findMany({
    where: {
      userId,
      date: { gte: since },
      [fieldName]: { not: null },
    },
    select: { date: true, [fieldName]: true },
    orderBy: { date: 'asc' },
  });

  return measurements.map(m => ({
    date: m.date.toISOString().split('T')[0],
    value: m[fieldName],
    weight: m[fieldName], // 兼容存量前端
    metric,
  }));
}

/**
 * Get weight trend data for charts (backward compatible).
 */
export async function getWeightTrend(userId, days = 90) {
  return getMeasurementTrend(userId, 'weight', days);
}
