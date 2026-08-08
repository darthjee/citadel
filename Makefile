.PHONY: build-base push-base build build-fe-base push-fe-base build-fe push-fe build-circleci-base push-circleci-base build-production-base push-production-base dev dev-up setup tests

PROJECT?=citadel_placeholder
IMAGE?=$(PROJECT)
BASE_VERSION?=0.0.1
FE_IMAGE?=$(DOCKER_ID_USER)/vite_$(PROJECT)
PUSH_IMAGE=$(DOCKER_ID_USER)/$(PROJECT)
DOCKER_FILE=dockerfiles/$(PROJECT)/Dockerfile
DOCKER_FILE_FE=dockerfiles/vite_$(PROJECT)/Dockerfile

# ── Base images ────────────────────────────────────────────────────────────────

build-base:
	bin/image.sh build $(PROJECT)-base

push-base:
	bin/image.sh push $(PROJECT)-base

build-circleci-base:
	bin/image.sh build circleci_$(PROJECT)-base

push-circleci-base:
	bin/image.sh push circleci_$(PROJECT)-base

build-production-base:
	bin/image.sh build production_$(PROJECT)-base

push-production-base:
	bin/image.sh push production_$(PROJECT)-base

build-fe-base:
	bin/image.sh build vite_$(PROJECT)-base

push-fe-base:
	bin/image.sh push vite_$(PROJECT)-base

# ── Backend ──────────────────────────────────────────────────────────────────
# Note: the leaf citadel_placeholder (backend app) and production_citadel_placeholder images are not
# published to Docker Hub — only the 4 *-base images are (see
# .claude/agents/infra.md "Backend image publishing" and
# docs/agents/architecture/backend.md).

build:
	docker build -f $(DOCKER_FILE) . -t $(IMAGE) -t $(PUSH_IMAGE) -t $(PUSH_IMAGE):$(BASE_VERSION)

# ── Frontend ─────────────────────────────────────────────────────────────────

build-fe:
	docker build -f $(DOCKER_FILE_FE) . -t $(FE_IMAGE) -t $(FE_IMAGE):$(BASE_VERSION)

push-fe:
	make build-fe
	docker push $(FE_IMAGE)
	docker push $(FE_IMAGE):$(BASE_VERSION)

# ── Development ───────────────────────────────────────────────────────────────

setup: .env
	docker-compose run --rm $(PROJECT)_app yarn migration:run

dev:
	docker-compose run $(PROJECT)_app /bin/bash

dev-up:
	docker-compose up $(PROJECT)_proxy $(PROJECT)_app $(PROJECT)_fe

tests:
	docker-compose run $(PROJECT)_tests /bin/bash

# ── Environment files ─────────────────────────────────────────────────────────

.env:
	cp .env.dev.sample .env

.env.production:
	touch .env.production
