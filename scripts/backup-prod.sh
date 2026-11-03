#!/usr/bin/env sh
set -eu

SCRIPT_DIRECTORY=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$SCRIPT_DIRECTORY/docker-compose.prod.yml" ]; then
  ROOT_DIRECTORY=$SCRIPT_DIRECTORY
else
  ROOT_DIRECTORY=$(CDPATH= cd -- "$SCRIPT_DIRECTORY/.." && pwd)
fi
BACKUP_DIRECTORY=${BACKUP_DIRECTORY:-"$ROOT_DIRECTORY/backups"}
PRODUCTION_ENV_FILE=${PRODUCTION_ENV_FILE:-"$ROOT_DIRECTORY/production.env"}
RELEASE_ENV_FILE=${RELEASE_ENV_FILE:-"$ROOT_DIRECTORY/release.env"}
COMPOSE_FILE=${COMPOSE_FILE:-"$ROOT_DIRECTORY/docker-compose.prod.yml"}

[ -f "$PRODUCTION_ENV_FILE" ] || { echo "缺少生产环境变量文件：$PRODUCTION_ENV_FILE" >&2; exit 1; }
[ -f "$RELEASE_ENV_FILE" ] || { echo "缺少发布版本文件：$RELEASE_ENV_FILE" >&2; exit 1; }

mkdir -p "$BACKUP_DIRECTORY"
BACKUP_FILE="$BACKUP_DIRECTORY/jizhang-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose \
  --env-file "$PRODUCTION_ENV_FILE" \
  --env-file "$RELEASE_ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$BACKUP_FILE"

test -s "$BACKUP_FILE"
find "$BACKUP_DIRECTORY" -type f -name 'jizhang-*.dump' -mtime +14 -delete
echo "数据库备份完成：$BACKUP_FILE"
