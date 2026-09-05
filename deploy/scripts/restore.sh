#!/bin/bash
# ============================================================
# FitLog Database Restore Script (Bare-metal MySQL)
# ============================================================
# Usage: ./restore.sh <backup_file.sql.gz>

set -euo pipefail

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "错误: 请指定有效的备份文件路径！"
    echo "用法: $0 <backup_file.sql.gz>"
    exit 1
fi

ENV_FILE="${ENV_FILE:-/opt/fitlog/server/.env}"
if [ -f "$ENV_FILE" ]; then
    DB_USER=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed -E 's/.*:\/\/([^:]+):.*/\1/' || true)
    DB_PASS=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed -E 's/.*:\/\/[^:]+:([^@]+)@.*/\1/' || true)
    DB_NAME=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed -E 's/.*\/([^?]+)(\?.*)?$/\1/' || true)
fi

DB_USER="${DB_USER:-fitlog_user}"
DB_PASS="${DB_PASS:-}"
DB_NAME="${DB_NAME:-fitlog_prod}"

echo "[RESTORE] 警告: 即将向数据库 ($DB_NAME) 导入还原数据: $BACKUP_FILE"
read -p "确认继续恢复吗？此操作会覆盖当前数据库数据！(y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "[RESTORE] 操作已取消。"
    exit 0
fi

echo "[RESTORE] 正在执行数据还原..."

if [ -n "$DB_PASS" ]; then
    gunzip < "$BACKUP_FILE" | mysql -h 127.0.0.1 -u"$DB_USER" -p"$DB_PASS" "$DB_NAME"
else
    gunzip < "$BACKUP_FILE" | mysql -h 127.0.0.1 -u"$DB_USER" "$DB_NAME"
fi

echo "[RESTORE] 数据还原完成！"
