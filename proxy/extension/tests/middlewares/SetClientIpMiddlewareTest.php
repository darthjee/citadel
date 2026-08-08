<?php

namespace Tent\Middlewares\Tests;

use PHPUnit\Framework\TestCase;
use Tent\Middlewares\SetClientIpMiddleware;
use Tent\Models\ProcessingRequest;

/**
 * Unit tests for SetClientIpMiddleware.
 *
 * Run via docker-compose:
 *   docker-compose run proxy_tests
 */
class SetClientIpMiddlewareTest extends TestCase
{
    /**
     * Builds a real ProcessingRequest instance with the given headers.
     */
    private function makeRequest(array $headers): ProcessingRequest
    {
        return new ProcessingRequest(['headers' => $headers]);
    }

    /**
     * When no X-Forwarded-For header is present on the incoming request, one
     * is added carrying the request's own remote address.
     */
    public function testAddsHeaderWhenAbsent(): void
    {
        $request = $this->makeRequest(['Content-Type' => 'application/json']);
        $middleware = new SetClientIpMiddleware(fn(): string => '203.0.113.7');

        $result = $middleware->processRequest($request);

        $this->assertSame([
            'Content-Type' => 'application/json',
            'X-Forwarded-For' => '203.0.113.7',
        ], $result->headers());
    }

    /**
     * A client-supplied X-Forwarded-For value must never survive: it is
     * fully replaced by the real remote address, not appended to or left in
     * place.
     */
    public function testReplacesSpoofedHeader(): void
    {
        $request = $this->makeRequest([
            'Content-Type' => 'application/json',
            'X-Forwarded-For' => '10.0.0.1',
        ]);
        $middleware = new SetClientIpMiddleware(fn(): string => '203.0.113.7');

        $result = $middleware->processRequest($request);

        $this->assertSame([
            'Content-Type' => 'application/json',
            'X-Forwarded-For' => '203.0.113.7',
        ], $result->headers());
    }

    /**
     * A differently-cased X-Forwarded-For header sent by the client is also
     * fully replaced, guarding against case-insensitive spoofing.
     */
    public function testReplacesSpoofedHeaderRegardlessOfCase(): void
    {
        $request = $this->makeRequest([
            'x-forwarded-for' => '10.0.0.1',
        ]);
        $middleware = new SetClientIpMiddleware(fn(): string => '203.0.113.7');

        $result = $middleware->processRequest($request);

        $this->assertSame([
            'X-Forwarded-For' => '203.0.113.7',
        ], $result->headers());
    }

    /**
     * Every other request header is left untouched.
     */
    public function testOnlyForwardedForHeaderIsChanged(): void
    {
        $request = $this->makeRequest([
            'Host' => 'backend:8080',
            'Authorization' => 'Bearer token',
            'X-Forwarded-For' => '10.0.0.1',
        ]);
        $middleware = new SetClientIpMiddleware(fn(): string => '203.0.113.7');

        $result = $middleware->processRequest($request);

        $this->assertSame([
            'Host' => 'backend:8080',
            'Authorization' => 'Bearer token',
            'X-Forwarded-For' => '203.0.113.7',
        ], $result->headers());
    }

    /**
     * build() ignores its attributes argument and always returns a usable
     * instance, since this middleware is not configurable. This is also the
     * one remaining exercise of the default provider, which reads the real
     * `$_SERVER['REMOTE_ADDR']`.
     *
     * @SuppressWarnings(PHPMD.Superglobals) This test deliberately exercises
     *     the real `$_SERVER` default supplied by build().
     * @SuppressWarnings(PHPMD.StaticAccess) SetClientIpMiddleware::build() is
     *     the static factory contract mandated by the Tent middleware
     *     framework; this test exists specifically to exercise it.
     */
    public function testBuildReturnsUsableInstance(): void
    {
        $originalServer = $_SERVER;
        $_SERVER['REMOTE_ADDR'] = '198.51.100.42';

        try {
            $middleware = SetClientIpMiddleware::build([]);
            $request = $this->makeRequest([]);

            $result = $middleware->processRequest($request);

            $this->assertSame(['X-Forwarded-For' => '198.51.100.42'], $result->headers());
        } finally {
            $_SERVER = $originalServer;
        }
    }
}
