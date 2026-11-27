# Tolerant private cache dir remover

Create `Tent\Content\PrivateCacheDirRemover`. It is the delete helper used by invalidation (step 05)
and GC (step 06) (issue: Edge cases #10, #11, #13).

- `__construct(string $basePath)`, normalised with `rtrim('/')` (and `realpath` when the path
  exists).
- `removeTree(string $dir): void`:
  - **Containment:** refuse anything not strictly under `$basePath . '/'`, both before and after
    resolving the path.
  - **Delete:** walk the tree children-first, without following symlinks. A symlink is `unlink`ed;
    its target is never touched.
  - **Tolerance:** a file or folder that vanished (or a failed `unlink`/`rmdir` whose target no
    longer exists afterwards) counts as success. No PHP warning: use `@` plus a post-check, or a
    scoped error handler.
  - **Other failures** are logged with the directory relative to the base, and never throw.
- `removeFile(string $path): bool` does the same for a single file. GC uses it to delete the meta
  file before the body.
- A docblock notes that darthjee/tent#316 may later replace this with a tolerant
  `CacheDirCleaner`.
- Never log filenames that contain `private_` hashes. Log only counts or the relative directory of
  the request path.

Tests (`tests/content/PrivateCacheDirRemoverTest.php`), using a temp directory per test:

- removes a nested tree;
- a missing directory is a silent no-op;
- a path outside the base (including via `..` and via a symlink pointing out) is refused and left
  intact;
- a symlink inside the tree is removed and its target survives;
- a file or subfolder deleted mid-walk is tolerated. Use an injectable "before delete" hook or a
  test subclass to simulate it.
- no warning is emitted (convert warnings to exceptions in the test).

## Files to Change
- `proxy/extension/lib/content/PrivateCacheDirRemover.php` — new helper.
- `proxy/extension/tests/content/PrivateCacheDirRemoverTest.php` — new tests (new `tests/content/`
  folder).
