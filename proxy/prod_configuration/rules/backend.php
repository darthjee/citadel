<?php

/**
 * Backend routing rules.
 * Forwards all .json requests to the NestJS backend.
 *
 * This rule is the opt-out API cache: every 2xx .json response is
 * shared-cached by Tent unless it carries the X-Skip-Cache header.
 * Routes opt out through the backend's @CachePolicy() decorator, which
 * sets X-Skip-Cache for user-scoped/never classes and for any method
 * other than GET/HEAD.
 *
 * CacheStalenessMiddleware's maxAgeSeconds must stay in sync with the
 * backend's PUBLIC_MAX_AGE_SECONDS (backend/src/core/cache-class.ts);
 * change both together.
 *
 * Full strategy: docs/agents/architecture/caching.md
 */

use Tent\Configuration;
use Tent\Models\Rule;
use Tent\Handlers\ProxyRequestHandler;
use Tent\Models\Server;
use Tent\Models\RequestMatcher;

Configuration::buildRule([
    'handler' => [
        'type' => 'default_proxy',
        'host' => $backendHost,
        'skip_cache_header' => 'X-Skip-Cache'
    ],
    'matchers' => [
        ['uri' => '.json', 'type' => 'ends_with']
    ],
    'middlewares' => [
        [
            'class' => 'Tent\\Middlewares\\SetClientIpMiddleware'
        ],
        [
            'class'    => 'Tent\\Middlewares\\CacheCleanupMiddleware',
            'location' => $cacheFolder,
            'clear'    => ['collection', 'entity']
        ],
        [
            'class' => 'Tent\\Middlewares\\CacheStalenessMiddleware',
            'location' => $cacheFolder,
            'host' => $backendHost,
            'maxAgeSeconds' => 10
        ]
    ]
]);
