ARG BASE_VERSION=latest
FROM darthjee/scripts:0.8.0 as scripts
FROM darthjee/production_citadel_placeholder-base:${BASE_VERSION} as base

######################################

FROM base as builder

COPY --chown=node:node ./backend/ /home/node/app/

ENV HOME_DIR /home/node

USER node
COPY --chown=node:node --from=scripts /home/scripts/builder/yarn_builder.sh /usr/local/sbin/yarn_builder.sh
RUN /bin/bash yarn_builder.sh
RUN yarn build
RUN find src -type d -name tests -exec rm -rf {} +

#######################
# FINAL IMAGE
FROM base
ENV HOME_DIR /home/node

COPY --chown=node:node --from=builder /home/node/yarn/new/ /usr/local/share/.cache/yarn/v6/
COPY --chown=node:node --from=builder /home/node/app/ /home/node/app/

USER node

RUN yarn install --production

COPY --chown=node:node ./dockerfiles/production_citadel_placeholder/entrypoint.sh /home/node/app/entrypoint.sh

ENTRYPOINT ["/home/node/app/entrypoint.sh"]
