#!/usr/bin/env sh
set -eu

ROOT_DIRECTORY=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PRODUCTION_ENV_FILE=${PRODUCTION_ENV_FILE:-"$ROOT_DIRECTORY/production.env"}
RELEASE_ENV_FILE=${RELEASE_ENV_FILE:-"$ROOT_DIRECTORY/release.env"}
COMPOSE_FILE=${COMPOSE_FILE:-"$ROOT_DIRECTORY/docker-compose.prod.yml"}
RELEASE_TAG=${RELEASE_TAG:?RELEASE_TAG is required}
BACKEND_CHANGED=${BACKEND_CHANGED:-false}
FRONTEND_CHANGED=${FRONTEND_CHANGED:-false}
DEPLOYMENT_CHANGED=${DEPLOYMENT_CHANGED:-false}

[ -f "$PRODUCTION_ENV_FILE" ] || { echo "缺少生产环境变量文件：$PRODUCTION_ENV_FILE" >&2; exit 1; }

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

compose up -d postgres redis

if [ "$BACKEND_CHANGED" = "true" ]; then
  sh "$ROOT_DIRECTORY/scripts/backup-prod.sh"
  compose run --rm --no-deps backend ./node_modules/.bin/prisma migrate deploy
fi

if [ "$DEPLOYMENT_CHANGED" = "true" ]; then
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
