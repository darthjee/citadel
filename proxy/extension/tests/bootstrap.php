<?php

/**
 * PHPUnit bootstrap for proxy/extension tests.
 *
 * Loads the full Tent framework (all lib classes) via the main loader.php,
 * which in turn auto-loads extension/loader.php and registers all custom
 * handlers and middlewares defined under proxy/extension/.
 */

require_once '/var/www/html/loader.php';

// Shared test doubles (kept out of the *Test.php files so each file declares
// a single class, per PSR-1).
require_once __DIR__ . '/support/DomainHashTestRequest.php';
