# Shared, parameterised Dockerfile for all the *-base images:
#   citadel_placeholder-base, vite_citadel_placeholder-base, production_citadel_placeholder-base, circleci_citadel_placeholder-base
#
# Each image is selected with `docker build --target <image>` and the per-image
# build args are supplied by bin/image.sh (see the `build_args` function there).
#
# The version pins below are the single place where the darthjee/scripts and
# darthjee/node (or darthjee/circleci_node) versions are defined.

# Only visible to the FROM lines below
ARG SCRIPTS_IMAGE=darthjee/scripts:0.8.0
ARG NODE_IMAGE_VERSION=0.2.1
# bin/image.sh always passes it; the default only keeps the FROM line valid
ARG BASE_IMAGE=darthjee/node

FROM ${SCRIPTS_IMAGE} AS scripts
FROM ${BASE_IMAGE}:${NODE_IMAGE_VERSION} AS base

ARG USER_NAME
# Empty RSYNC_VERSION means rsync is not installed
ARG RSYNC_VERSION

USER root
RUN if [ -n "$RSYNC_VERSION" ]; then \
      apt-get update \
      && apt-get install -y --no-install-recommends rsync=$RSYNC_VERSION \
      && rm -rf /var/lib/apt/lists/*; \
    fi
USER $USER_NAME

######################################

FROM base AS builder

ARG USER_NAME
ARG HOME_DIR
ARG APP_DIR
ARG SOURCE_DIR
# User running yarn_builder.sh. It must be able to write to the global yarn cache
# (/usr/local/share/.cache/yarn/v6, owned by root in the node images), otherwise
# yarn_builder.sh finds no "new" packages and the pre-warmed cache ends up empty.
# bin/image.sh sets it to root for the node images that are meant to be warmed
# (citadel_placeholder-base, vite_citadel_placeholder-base) and to $USER_NAME for the others.
ARG BUILDER_USER

ENV HOME_DIR=$HOME_DIR

COPY --chown=$USER_NAME:$USER_NAME \
  ./$SOURCE_DIR/package.json $SOURCE_DIR/yarn.lock \
  $APP_DIR/

USER $BUILDER_USER
COPY --chown=$USER_NAME:$USER_NAME --from=scripts /home/scripts/builder/yarn_builder.sh /usr/local/sbin/yarn_builder.sh
# TODO: confirm whether yarn_builder.sh takes a production-only-deps flag
# (like `poetry_builder.sh --only main`) once darthjee/scripts is inspectable.
RUN /bin/bash yarn_builder.sh

#######################
# FINAL IMAGE (common part)
FROM base AS final

ARG USER_NAME
ARG HOME_DIR
ARG YARN_CACHE_DIR

ENV HOME_DIR=$HOME_DIR

COPY --chown=$USER_NAME:$USER_NAME --from=builder $HOME_DIR/yarn/new/ $YARN_CACHE_DIR/

USER $USER_NAME

#######################
# PER-IMAGE TARGETS
# An exec-form CMD cannot be parameterised by an ARG without going through
# `sh -c`, so each image keeps its own CMD in a thin target.

FROM final AS citadel_placeholder-base

# The dev container mounts ./backend over /home/node/app at runtime (see
# docker-compose.yml), so there's no compiled TS source at image-build time —
# the build has to run against the mounted source right before starting the
# compiled Nest entrypoint.
CMD ["sh", "-c", "yarn build && node dist/main.js"]

FROM final AS vite_citadel_placeholder-base

CMD ["npm", "run", "server"]

FROM final AS production_citadel_placeholder-base

CMD ["node", "dist/main.js"]

FROM final AS circleci_citadel_placeholder-base
