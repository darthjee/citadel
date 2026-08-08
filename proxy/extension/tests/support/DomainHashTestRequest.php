<?php

namespace Tent\Cache\Tests;

use Tent\Models\RequestInterface;

/**
 * Minimal RequestInterface double carrying a fixed domain and query string.
 *
 * Deliberately independent of Tent's own Request/ProcessingRequest classes:
 * `domain()` support on those varies across Tent versions (it's part of the
 * production `darthjee/tent` image this proxy runs on, but absent from the
 * `darthjee/tent-test` image's bundled Tent source used to run this suite),
 * so this double is the only reliable way to exercise DomainHash's use of
 * `RequestInterface::domain()` here.
 */
class DomainHashTestRequest implements RequestInterface
{
    public function __construct(private string $domain, private string $query)
    {
    }

    public function requestMethod()
    {
        return 'GET';
    }

    public function body()
    {
        return '';
    }

    public function headers()
    {
        return [];
    }

    public function requestPath(): string
    {
        return '/issues.json';
    }

    public function query()
    {
        return $this->query;
    }

    public function uploadedFiles(): array
    {
        return [];
    }

    public function postFields(): array
    {
        return [];
    }

    public function domain(): string
    {
        return $this->domain;
    }
}
