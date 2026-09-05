#!/bin/sh
# ==========================================
# FitLog 数据库一键恢复脚本
# 用法: ./restore.sh <backup_file.sql.gz>
# ==========================================

set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "错误: 请指定有效的备份文件路径！"
  echo "用法: $0 <backup_file.sql.gz>"
  exit 1
fi

echo "[RESTORE] 警告: 即将向数据库导入恢复数据: $BACKUP_FILE"
read -p "确认继续恢复吗？(y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "[RESTORE] 操作已取消。"
  exit 0
fi

echo "[RESTORE] 正在执行数据还原..."

gunzip < "$BACKUP_FILE" | docker compose exec -T mysql mysql \
  -u"${MYSQL_USER:-fitlog_user}" \
  -p"${MYSQL_PASSWORD:-fitlog_pass}" \
  "${MYSQL_DATABASE:-fitlog_prod}"

echo "[RESTORE] 数据还原完成！"
