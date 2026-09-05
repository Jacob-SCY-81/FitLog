#!/bin/sh
# ==========================================
# FitLog 数据库一键自动备份脚本
# ==========================================

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/fitlog_db_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[BACKUP] 开始备份 FitLog 数据库..."

# 通过 docker-compose 执行 mysqldump 并 gzip 压缩
docker compose exec -T mysql mysqldump \
  -u"${MYSQL_USER:-fitlog_user}" \
  -p"${MYSQL_PASSWORD:-fitlog_pass}" \
  --single-transaction \
  --quick \
  "${MYSQL_DATABASE:-fitlog_prod}" | gzip > "$BACKUP_FILE"

echo "[BACKUP] 备份成功完成: $BACKUP_FILE (大小: $(du -h "$BACKUP_FILE" | cut -f1))"

# 自动清理 30 天以前的旧备份
find "$BACKUP_DIR" -name "fitlog_db_backup_*.sql.gz" -type f -mtime +30 -delete 2>/dev/null || true
echo "[BACKUP] 历史备份清理完成 (保留近 30 天)"
