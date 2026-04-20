#!/usr/bin/env bash

set -euo pipefail

required_vars=(
  IMAGE_REF
  GHCR_USERNAME
  GHCR_TOKEN
  CONTAINER_NAME
  ENV_FILE
  LOCAL_HEALTH_URL
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
done

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Runtime env file not found: ${ENV_FILE}" >&2
  exit 1
fi

health_check() {
  local url="$1"
  local attempts="${2:-30}"
  local sleep_seconds="${3:-2}"
  local attempt=1

  until curl --fail --silent --show-error "${url}" >/dev/null; do
    if (( attempt >= attempts )); then
      return 1
    fi

    echo "Waiting for local health check (${attempt}/${attempts})..."
    sleep "${sleep_seconds}"
    (( attempt += 1 ))
  done
}

container_exists() {
  docker container inspect "${CONTAINER_NAME}" >/dev/null 2>&1
}

start_container() {
  local image="$1"

  docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --env-file "${ENV_FILE}" \
    -p 4000:4000 \
    "${image}"
}

echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin >/dev/null

previous_image="$(docker inspect "${CONTAINER_NAME}" --format '{{.Config.Image}}' 2>/dev/null || true)"

echo "Pulling ${IMAGE_REF}..."
docker pull "${IMAGE_REF}"

if container_exists; then
  echo "Stopping current container ${CONTAINER_NAME}..."
  docker stop "${CONTAINER_NAME}" >/dev/null
  docker rm "${CONTAINER_NAME}" >/dev/null
fi

echo "Starting new container ${CONTAINER_NAME}..."
start_container "${IMAGE_REF}"

if health_check "${LOCAL_HEALTH_URL}"; then
  echo "Deploy succeeded with ${IMAGE_REF}."
  exit 0
fi

echo "New container failed health check. Removing failed container..." >&2
if container_exists; then
  docker stop "${CONTAINER_NAME}" >/dev/null || true
  docker rm "${CONTAINER_NAME}" >/dev/null || true
fi

if [[ -n "${previous_image}" ]]; then
  echo "Rolling back to previous image ${previous_image}..." >&2
  start_container "${previous_image}"

  if health_check "${LOCAL_HEALTH_URL}"; then
    echo "Rollback succeeded, but deploy failed." >&2
    exit 1
  fi

  echo "Rollback container also failed health checks. Manual intervention required." >&2
  exit 1
fi

echo "No previous image available for rollback. Manual intervention required." >&2
exit 1
