#!/bin/bash

PLATFORM=${PLATFORM:-linux/amd64}

function image_version() {
  local image=$1
  cat version | grep "^${image}=" | sed -e "s/${image}=//g"
}

# Fills the BUILD_ARGS array with the --build-arg set for the given image.
# The darthjee/scripts and darthjee/node version pins are NOT defined here:
# they live only as ARG defaults in dockerfiles/base/Dockerfile.
function build_args() {
  local image=$1

  local node_user=node
  local node_home=/home/node
  local node_yarn_cache=/usr/local/share/.cache/yarn/v6

  BUILD_ARGS=()

  case "$image" in
    "citadel_placeholder-base")
      BUILD_ARGS=(
        --build-arg "BASE_IMAGE=darthjee/node"
        --build-arg "USER_NAME=$node_user"
        --build-arg "BUILDER_USER=root"
        --build-arg "HOME_DIR=$node_home"
        --build-arg "APP_DIR=$node_home/app"
        --build-arg "SOURCE_DIR=backend"
        --build-arg "YARN_CACHE_DIR=$node_yarn_cache"
        --build-arg "RSYNC_VERSION=3.2.7-1+deb12u6"
      )
      ;;
    "vite_citadel_placeholder-base")
      BUILD_ARGS=(
        --build-arg "BASE_IMAGE=darthjee/node"
        --build-arg "USER_NAME=$node_user"
        --build-arg "BUILDER_USER=root"
        --build-arg "HOME_DIR=$node_home"
        --build-arg "APP_DIR=$node_home/app"
        --build-arg "SOURCE_DIR=frontend"
        --build-arg "YARN_CACHE_DIR=$node_yarn_cache"
        --build-arg "RSYNC_VERSION=3.2.7-1+deb12u6"
      )
      ;;
    "production_citadel_placeholder-base")
      BUILD_ARGS=(
        --build-arg "BASE_IMAGE=darthjee/node"
        --build-arg "USER_NAME=$node_user"
        --build-arg "BUILDER_USER=$node_user"
        --build-arg "HOME_DIR=$node_home"
        --build-arg "APP_DIR=$node_home/app"
        --build-arg "SOURCE_DIR=backend"
        --build-arg "YARN_CACHE_DIR=$node_yarn_cache"
        --build-arg "RSYNC_VERSION="
      )
      ;;
    "circleci_citadel_placeholder-base")
      BUILD_ARGS=(
        --build-arg "BASE_IMAGE=darthjee/circleci_node"
        --build-arg "USER_NAME=circleci"
        --build-arg "BUILDER_USER=circleci"
        --build-arg "HOME_DIR=/home/circleci"
        --build-arg "APP_DIR=/home/circleci/project"
        --build-arg "SOURCE_DIR=backend"
        --build-arg "YARN_CACHE_DIR=/home/circleci/.cache/yarn/v6"
        --build-arg "RSYNC_VERSION=3.2.7-0ubuntu0.22.04.7"
      )
      ;;
    *)
      echo "Unknown image: '${image}'." >&2
      echo "Known images: citadel_placeholder-base, vite_citadel_placeholder-base, production_citadel_placeholder-base, circleci_citadel_placeholder-base" >&2
      exit 1
      ;;
  esac
}

function skip_if_not_tag() {
  if [ -n "$FORCE_IMAGE_BUILD" ]; then
    echo "FORCE_IMAGE_BUILD set, bypassing tag guard."
    return 0
  fi

  if [ -z "$CIRCLE_TAG" ]; then
    echo "Not a tag build, skipping."
    exit 0
  fi
}

function skip_if_unchanged() {
  local image=$1

  if [ -n "$FORCE_IMAGE_BUILD" ]; then
    echo "FORCE_IMAGE_BUILD set, bypassing unchanged guard."
    return 0
  fi

  local prev_tag
  prev_tag=$(git tag --sort=-creatordate | awk 'NR==2{print; exit}')

  if [ -z "$prev_tag" ]; then
    echo "No previous tag found, proceeding with release of ${image}."
    return 0
  fi

  # All images share dockerfiles/base/Dockerfile and their per-image args live
  # in this script, so a change to either one rebuilds every image.
  if git diff --quiet "$prev_tag"..HEAD -- dockerfiles/base/ bin/image.sh; then
    echo "No changes in dockerfiles/base/ or bin/image.sh since ${prev_tag}, skipping ${image}."
    exit 0
  fi
}

function setup_qemu() {
  local image=$1

  skip_if_not_tag

  skip_if_unchanged "$image"

  docker run --privileged --rm tonistiigi/binfmt --install all
}

function build() {
  local image=$1
  local arch=$2
  local version
  version=$(image_version "$image")

  local platform tag_suffix
  if [ -n "$arch" ]; then
    platform="linux/$arch"
    tag_suffix="-$arch"
  else
    platform="$PLATFORM"
    tag_suffix=""
  fi

  build_args "$image"

  local latest_tag="$DOCKER_ID_USER/$image:latest${tag_suffix}"
  local cached_tag="$DOCKER_ID_USER/$image:cached${tag_suffix}"
  local version_tag="$DOCKER_ID_USER/$image:${version}${tag_suffix}"

  docker tag "$latest_tag" "$cached_tag" 2>/dev/null || true
  docker rmi "$latest_tag" 2>/dev/null || true
  docker build --platform "$platform" \
    -f dockerfiles/base/Dockerfile --target "$image" \
    "${BUILD_ARGS[@]}" . \
    -t "$latest_tag"
  docker tag "$latest_tag" "$version_tag"
  if docker images | grep -q "$cached_tag"; then
    docker rmi "$cached_tag"
  fi
}

function push() {
  local image=$1
  local arch=$2
  local version tag_suffix
  version=$(image_version "$image")
  [ -n "$arch" ] && tag_suffix="-$arch" || tag_suffix=""

  skip_if_not_tag

  skip_if_unchanged "$image"

  echo "$DOCKER_HUB_PASSWORD" | docker login -u "$DOCKER_HUB_USERNAME" --password-stdin

  build "$image" "$arch"
  docker push "$DOCKER_ID_USER/$image:latest${tag_suffix}"
  docker push "$DOCKER_ID_USER/$image:${version}${tag_suffix}"
}

ACTION=$1
IMAGE_NAME=$2
ARCH=${3:-}

case $ACTION in
  "build") build "$IMAGE_NAME" "$ARCH" ;;
  "push")  push "$IMAGE_NAME" "$ARCH" ;;
  "qemu")  setup_qemu "$IMAGE_NAME" ;;
  *)
    echo "Usage: $0 <action> <image_name> [arch]"
    echo "Actions: build, push, qemu"
    exit 1
    ;;
esac
