#!/usr/bin/env sh
set -eu

SCRIPT_DIRECTORY=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$SCRIPT_DIRECTORY/docker-compose.prod.yml" ]; then
  ROOT_DIRECTORY=$SCRIPT_DIRECTORY
else
  ROOT_DIRECTORY=$(CDPATH= cd -- "$SCRIPT_DIRECTORY/.." && pwd)
fi
PRODUCTION_ENV_FILE=${PRODUCTION_ENV_FILE:-"$ROOT_DIRECTORY/production.env"}
PRODUCTION_ENV_CANDIDATE_FILE=${PRODUCTION_ENV_CANDIDATE_FILE:-"$ROOT_DIRECTORY/production.env.new"}
RELEASE_ENV_FILE=${RELEASE_ENV_FILE:-"$ROOT_DIRECTORY/release.env"}
COMPOSE_FILE=${COMPOSE_FILE:-"$ROOT_DIRECTORY/docker-compose.prod.yml"}
RELEASE_TAG=${RELEASE_TAG:?RELEASE_TAG is required}
BACKEND_CHANGED=${BACKEND_CHANGED:-false}
FRONTEND_CHANGED=${FRONTEND_CHANGED:-false}
DEPLOYMENT_CHANGED=${DEPLOYMENT_CHANGED:-false}
CONFIG_CHANGED=false

if [ -f "$PRODUCTION_ENV_CANDIDATE_FILE" ]; then
  chmod 600 "$PRODUCTION_ENV_CANDIDATE_FILE"
  if [ ! -f "$PRODUCTION_ENV_FILE" ] || ! cmp -s "$PRODUCTION_ENV_CANDIDATE_FILE" "$PRODUCTION_ENV_FILE"; then
    CONFIG_CHANGED=true
  fi
  PRODUCTION_ENV_FILE="$PRODUCTION_ENV_CANDIDATE_FILE"
elif [ ! -f "$PRODUCTION_ENV_FILE" ]; then
  echo "缺少生产环境变量文件：$PRODUCTION_ENV_FILE" >&2
  exit 1
fi

validate_production_env() {
  env_file=$1
  for key in DB_USER DB_PASSWORD DB_NAME JWT_ACCESS_SECRET JWT_ADMIN_ACCESS_SECRET CORS_ORIGINS; do
    value=$(awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$env_file")
    [ -n "$value" ] || {
      echo "生产环境变量缺少必填项：$key" >&2
      exit 1
    }
  done

  attachment_enabled=$(awk -F= '$1 == "ATTACHMENT_ENABLED" { sub(/^[^=]*=/, ""); print; exit }' "$env_file")
  case "$attachment_enabled" in
    ''|false) ;;
    true)
      provider=$(awk -F= '$1 == "OBJECT_STORAGE_PROVIDER" { sub(/^[^=]*=/, ""); print; exit }' "$env_file")
      [ "$provider" = "aliyun-oss" ] || {
        echo "附件已开启时 OBJECT_STORAGE_PROVIDER 必须为 aliyun-oss" >&2
        exit 1
      }
      for key in OSS_REGION OSS_ENDPOINT OSS_INTERNAL_ENDPOINT OSS_BUCKET OSS_ACCESS_KEY_ID OSS_ACCESS_KEY_SECRET; do
        value=$(awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$env_file")
        [ -n "$value" ] || {
          echo "附件已开启时生产环境变量缺少必填项：$key" >&2
          exit 1
        }
      done
      ;;
    *)
      echo "ATTACHMENT_ENABLED 必须是 true 或 false" >&2
      exit 1
      ;;
  esac
}

validate_production_env "$PRODUCTION_ENV_FILE"

if [ ! -f "$RELEASE_ENV_FILE" ] && { [ "$BACKEND_CHANGED" != "true" ] || [ "$FRONTEND_CHANGED" != "true" ]; }; then
  echo "首次部署必须同时提供前后端镜像，且不能缺少 release.env" >&2
  exit 1
fi

if [ "$BACKEND_CHANGED" = "true" ] && [ ! -f "$ROOT_DIRECTORY/xiaobao-jizhang-backend.tar.gz" ]; then
  echo "缺少待加载镜像：$ROOT_DIRECTORY/xiaobao-jizhang-backend.tar.gz" >&2
  exit 1
fi

if [ "$FRONTEND_CHANGED" = "true" ] && [ ! -f "$ROOT_DIRECTORY/xiaobao-jizhang-frontend.tar.gz" ]; then
  echo "缺少待加载镜像：$ROOT_DIRECTORY/xiaobao-jizhang-frontend.tar.gz" >&2
  exit 1
fi

read_release_value() {
  key=$1
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$RELEASE_ENV_FILE"
}

if [ "$BACKEND_CHANGED" = "true" ]; then
  BACKEND_IMAGE="xiaobao-jizhang-backend:${RELEASE_TAG}"
else
  BACKEND_IMAGE=$(read_release_value 'BACKEND_IMAGE')
  [ -n "$BACKEND_IMAGE" ] || { echo "release.env 缺少 BACKEND_IMAGE" >&2; exit 1; }
fi

if [ "$FRONTEND_CHANGED" = "true" ]; then
  FRONTEND_IMAGE="xiaobao-jizhang-frontend:${RELEASE_TAG}"
else
  FRONTEND_IMAGE=$(read_release_value 'FRONTEND_IMAGE')
  [ -n "$FRONTEND_IMAGE" ] || { echo "release.env 缺少 FRONTEND_IMAGE" >&2; exit 1; }
fi

cat > "$RELEASE_ENV_FILE.tmp" <<EOF
BACKEND_IMAGE=$BACKEND_IMAGE
FRONTEND_IMAGE=$FRONTEND_IMAGE
EOF
mv "$RELEASE_ENV_FILE.tmp" "$RELEASE_ENV_FILE"

compose() {
  docker compose \
    --env-file "$PRODUCTION_ENV_FILE" \
    --env-file "$RELEASE_ENV_FILE" \
    -f "$COMPOSE_FILE" "$@"
}

load_image() {
  image_archive=$1
  [ -f "$ROOT_DIRECTORY/$image_archive" ] || {
    echo "缺少待加载镜像：$ROOT_DIRECTORY/$image_archive" >&2
    exit 1
  }
  docker load -i "$ROOT_DIRECTORY/$image_archive"
  rm -f "$ROOT_DIRECTORY/$image_archive"
}

if [ "$BACKEND_CHANGED" = "true" ]; then
  load_image 'xiaobao-jizhang-backend.tar.gz'
fi

if [ "$FRONTEND_CHANGED" = "true" ]; then
  load_image 'xiaobao-jizhang-frontend.tar.gz'
fi

compose config >/dev/null

if [ "$PRODUCTION_ENV_FILE" = "$PRODUCTION_ENV_CANDIDATE_FILE" ]; then
  mv -f "$PRODUCTION_ENV_CANDIDATE_FILE" "$ROOT_DIRECTORY/production.env"
  chmod 600 "$ROOT_DIRECTORY/production.env"
  PRODUCTION_ENV_FILE="$ROOT_DIRECTORY/production.env"
fi

compose up -d --wait --wait-timeout 120 postgres redis

# 备份必须先于迁移：先改表结构再备份，备份就失去了回滚价值。
# BACKEND_CHANGED 只在后端镜像变化时为真，此时才存在 schema 变更的可能。
if [ "$BACKEND_CHANGED" = "true" ]; then
  BACKUP_SCRIPT="$ROOT_DIRECTORY/backup-prod.sh"
  if [ ! -f "$BACKUP_SCRIPT" ]; then
    BACKUP_SCRIPT="$ROOT_DIRECTORY/scripts/backup-prod.sh"
  fi
  sh "$BACKUP_SCRIPT"
fi

# 迁移每次部署都执行，不能挂在 BACKEND_CHANGED 下：
# 变更检测基线是单次提交的 diff，只改 scripts/ 或 .github/ 的发布同样会带上
# 新的后端镜像与 Prisma schema，被跳过就会让线上数据库停在旧结构。
# prisma migrate deploy 对已应用的迁移是幂等的，重复执行只做一次查询。
compose run --rm --no-deps backend ./node_modules/.bin/prisma migrate deploy

if [ "$DEPLOYMENT_CHANGED" = "true" ] || [ "$CONFIG_CHANGED" = "true" ]; then
  compose up -d --no-build backend frontend
else
  if [ "$BACKEND_CHANGED" = "true" ]; then
    compose up -d --no-build backend
  fi
  if [ "$FRONTEND_CHANGED" = "true" ]; then
    compose up -d --no-build frontend
  fi
fi

wait_for_health() {
  url=$1
  attempt=1
  while [ "$attempt" -le 30 ]; do
    if curl --fail --silent --show-error "$url" >/dev/null; then
      return 0
    fi
    sleep 2
    attempt=$((attempt + 1))
  done
  echo "健康检查失败：$url" >&2
  return 1
}

wait_for_health "http://127.0.0.1:${BACKEND_PORT:-8091}/api/health"
wait_for_health "http://127.0.0.1:${FRONTEND_PORT:-8090}/"
docker image prune -f
echo "发布完成：$RELEASE_TAG"
