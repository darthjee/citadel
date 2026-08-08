<?php

namespace Tent\Cache\Tests;

use PHPUnit\Framework\TestCase;
use Tent\Cache\DomainHash;
use Tent\Models\RequestInterface;

/**
 * Unit tests for DomainHash.
 *
 * Run via docker-compose:
 *   docker-compose run proxy_tests
 */
class DomainHashTest extends TestCase
{
    /**
     * Builds a minimal RequestInterface double carrying only the given
     * domain and query string, decoupled from Tent's own Request/
     * ProcessingRequest implementations (whose `domain()` support varies
     * across Tent versions).
     */
    private function makeRequest(string $domain, string $query = ''): RequestInterface
    {
        return new DomainHashTestRequest($domain, $query);
    }

    /**
     * The returned hash is exactly `'domain_' . hash('sha256', $domain)` —
     * the documented, reproducible format callers (and cache invalidation
     * tooling) can rely on.
     *
     * @SuppressWarnings(PHPMD.StaticAccess) DomainHash::hash() is a pure,
     *     stateless static helper (no I/O, no collaborators to substitute —
     *     see the class's own docblock).
     */
    public function testHashMatchesExpectedFormat(): void
    {
        $request = $this->makeRequest('citadel-placeholder-a.example.com', 'id=1');

        $result = DomainHash::hash($request);

        $this->assertSame('domain_' . hash('sha256', 'citadel-placeholder-a.example.com'), $result);
    }

    /**
     * The same domain always hashes identically.
     *
     * @SuppressWarnings(PHPMD.StaticAccess) DomainHash::hash() is a pure,
     *     stateless static helper (no I/O, no collaborators to substitute —
     *     see the class's own docblock).
     */
    public function testSameDomainHashesIdentically(): void
    {
        $first = DomainHash::hash($this->makeRequest('citadel-placeholder-a.example.com', 'id=1'));
        $second = DomainHash::hash($this->makeRequest('citadel-placeholder-a.example.com', 'id=1'));

        $this->assertSame($first, $second);
    }

    /**
     * Different domains hash differently — this is the whole point of
     * partitioning the cache by domain via the folder name.
     *
     * @SuppressWarnings(PHPMD.StaticAccess) DomainHash::hash() is a pure,
     *     stateless static helper (no I/O, no collaborators to substitute —
     *     see the class's own docblock).
     */
    public function testDifferentDomainsHashDifferently(): void
    {
        $domainA = DomainHash::hash($this->makeRequest('citadel-placeholder-a.example.com', 'id=1'));
        $domainB = DomainHash::hash($this->makeRequest('citadel-placeholder-b.example.com', 'id=1'));

        $this->assertNotSame($domainA, $domainB);
    }

    /**
     * The query string does not affect the hash — explicit contrast with the
     * old HostQueryRequestHasher, which mixed domain and query into the
     * cache-key hash. Domain-only partitioning via the folder (not
     * domain+query mixed into the key) is the whole point of this change.
     *
     * @SuppressWarnings(PHPMD.StaticAccess) DomainHash::hash() is a pure,
     *     stateless static helper (no I/O, no collaborators to substitute —
     *     see the class's own docblock).
     */
    public function testQueryStringDoesNotAffectHash(): void
    {
        $queryOne = DomainHash::hash($this->makeRequest('citadel-placeholder-a.example.com', 'id=1'));
        $queryTwo = DomainHash::hash($this->makeRequest('citadel-placeholder-a.example.com', 'id=2'));

        $this->assertSame($queryOne, $queryTwo);
    }
}
