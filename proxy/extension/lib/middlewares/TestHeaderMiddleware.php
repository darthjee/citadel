<?php

namespace Tent\Middlewares;

use Tent\Models\Response;

/**
 * Sample custom middleware that adds x-test-header to the response.
 *
 * This file demonstrates the pattern for writing custom Tent middleware.
 * Custom middleware classes belong in proxy/extension/ and use the Tent\ namespace.
 * Tests belong in proxy/extension/tests/.
 */
class TestHeaderMiddleware
{
    /**
     * Add the x-test-header response header.
     *
     * @param Response $response The HTTP response to be sent to the client.
     */
    public function handle(Response $response): void
    {
        $headers = $response->headers();
        $headers['x-test-header'] = 'added';
        $response->setHeaders($headers);
    }
}
