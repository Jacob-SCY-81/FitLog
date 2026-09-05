#!/bin/bash
# ============================================================
# FitLog Database Backup Script (Bare-metal MySQL)
# ============================================================
# Usage: ./backup.sh
# Creates gzipped SQL dump under /opt/fitlog/backups/

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/fitlog/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/fitlog_db_backup_${TIMESTAMP}.sql.gz"

# 优先读取生产环境变量中的数据库连接信息
ENV_FILE="${ENV_FILE:-/opt/fitlog/server/.env}"
if [ -f "$ENV_FILE" ]; then
    DB_USER=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed -E 's/.*:\/\/([^:]+):.*/\1/' || true)
    DB_PASS=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed -E 's/.*:\/\/[^:]+:([^@]+)@.*/\1/' || true)
    DB_NAME=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed -E 's/.*\/([^?]+)(\?.*)?$/\1/' || true)
fi

DB_USER="${DB_USER:-fitlog_user}"
DB_PASS="${DB_PASS:-}"
DB_NAME="${DB_NAME:-fitlog_prod}"

mkdir -p "$BACKUP_DIR"

echo "[BACKUP] 开始备份 FitLog 独立数据库 ($DB_NAME)..."

if [ -n "$DB_PASS" ]; then
    mysqldump -h 127.0.0.1 -u"$DB_USER" -p"$DB_PASS" \
        --single-transaction \
        --quick \
        "$DB_NAME" | gzip > "$BACKUP_FILE"
else
    mysqldump -h 127.0.0.1 -u"$DB_USER" \
        --single-transaction \
        --quick \
        "$DB_NAME" | gzip > "$BACKUP_FILE"
fi

echo "[BACKUP] 备份成功完成: $BACKUP_FILE (大小: $(du -h "$BACKUP_FILE" | cut -f1))"

# 自动清理 30 天以前的旧备份
find "$BACKUP_DIR" -name "fitlog_db_backup_*.sql.gz" -type f -mtime +30 -delete 2>/dev/null || true
echo "[BACKUP] 历史备份清理完成 (保留近 30 天)"
