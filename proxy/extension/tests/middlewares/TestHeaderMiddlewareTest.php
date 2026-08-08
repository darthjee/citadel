<?php

namespace Tent\Middlewares\Tests;

use PHPUnit\Framework\TestCase;
use Tent\Middlewares\TestHeaderMiddleware;
use Tent\Models\Response;

/**
 * Unit tests for TestHeaderMiddleware.
 *
 * Run via docker-compose:
 *   docker-compose run proxy_tests
 */
class TestHeaderMiddlewareTest extends TestCase
{
    public function testAddsTestHeader(): void
    {
        $response   = $this->createMock(Response::class);
        $middleware = new TestHeaderMiddleware();

        $response->method('headers')->willReturn([]);
        $response->expects($this->once())
            ->method('setHeaders')
            ->with(['x-test-header' => 'added']);

        $middleware->handle($response);
    }
}
