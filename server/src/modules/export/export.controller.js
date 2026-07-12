import * as exportService from './export.service.js';
import { success, error } from '../../lib/response.js';

export async function exportData(req, res, next) {
  try {
    await exportService.checkRateLimit(req.user.id);

    const format = req.query.format || 'json';
    const data = await exportService.exportJSON(req.user.id);

    if (format === 'csv') {
      const csv = exportService.formatCSV(data);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=fitlog-export-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    }

    // JSON (use res.send to avoid res.json overriding Content-Disposition)
    const jsonStr = JSON.stringify({
      exportedAt: new Date().toISOString(),
      workoutCount: data.length,
      workouts: data,
    }, null, 2);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=fitlog-export-${new Date().toISOString().split('T')[0]}.json`);
    return res.send(jsonStr);
  } catch (err) {
    next(err);
  }
}
