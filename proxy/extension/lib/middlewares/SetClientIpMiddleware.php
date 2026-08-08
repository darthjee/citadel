<?php

namespace Tent\Middlewares;

use Tent\Models\ProcessingRequest;

/**
 * Overwrites the `X-Forwarded-For` request header with Tent's own view of
 * the client's remote address, so the backend can trust it as the real
 * visitor IP.
 *
 * ## Why this exists
 *
 * There is exactly one hop between the client and the backend (client →
 * Tent → `http://backend:8080`). A client is free to send its own
 * `X-Forwarded-For` header on the original request; if that value were ever
 * forwarded as-is, a client could spoof the IP the backend records. This
 * middleware guarantees the header always carries Tent's own view of the
 * connecting peer (PHP's `$_SERVER['REMOTE_ADDR']`) by unconditionally
 * replacing any existing occurrence of the header — never appending to it,
 * since there is only ever one hop to represent.
 *
 * This middleware is not configurable: it always uses the current request's
 * `REMOTE_ADDR`.
 *
 * ## Usage in configuration
 *
 * ```php
 * Configuration::buildRule([
 *     'handler' => [...],
 *     'matchers' => [...],
 *     'middlewares' => [
 *         [
 *             'class' => 'Tent\\Middlewares\\SetClientIpMiddleware'
 *         ]
 *     ]
 * ]);
 * ```
 */
class SetClientIpMiddleware extends Middleware
{
    private const HEADER_NAME = 'X-Forwarded-For';

    /**
     * @var callable(): string Provides the current request's remote address.
     */
    private $remoteAddrProvider;

    /**
     * @param callable(): string $remoteAddrProvider Provides the current
     *                           request's remote address. build() supplies
     *                           one that reads PHP's own
     *                           `$_SERVER['REMOTE_ADDR']`.
     */
    public function __construct(callable $remoteAddrProvider)
    {
        $this->remoteAddrProvider = $remoteAddrProvider;
    }

    /**
     * Builds a SetClientIpMiddleware instance.
     *
     * This middleware takes no configurable attributes. The returned
     * instance lazily reads PHP's own `$_SERVER['REMOTE_ADDR']` each time a
     * request is processed.
     *
     * @SuppressWarnings(PHPMD.Superglobals) This is Tent's factory entry
     *     point, which must read the real connecting peer's address.
     * @SuppressWarnings(PHPMD.UnusedFormalParameter) $attributes is required
     *     by the base Middleware::build() contract.
     *
     * @param array $attributes Unused; present to satisfy the base
     *                           Middleware::build() contract.
     * @return SetClientIpMiddleware The constructed middleware instance.
     */
    public static function build(array $attributes): SetClientIpMiddleware
    {
        return new self(static fn(): string => (string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    }

    /**
     * Replaces any existing `X-Forwarded-For` header (case-insensitively)
     * with a single occurrence carrying the request's own remote address,
     * leaving every other header untouched.
     *
     * @param ProcessingRequest $request The request to process.
     * @return ProcessingRequest The request, with a single, trustworthy
     *                            `X-Forwarded-For` header set.
     */
    public function processRequest(ProcessingRequest $request): ProcessingRequest
    {
        $targetName = strtolower(self::HEADER_NAME);

        foreach (array_keys($request->headers()) as $name) {
            if (strtolower($name) === $targetName) {
                $request->removeHeader($name);
            }
        }

        $request->setHeader(self::HEADER_NAME, ($this->remoteAddrProvider)());

        return $request;
    }
}
