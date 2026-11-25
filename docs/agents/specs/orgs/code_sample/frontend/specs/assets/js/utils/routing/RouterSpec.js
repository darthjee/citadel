import Router from '../../../../../assets/js/utils/routing/Router.js';

describe('Router', () => {
  it('resolves a registered path to its page key', () => {
    const router = new Router();
    router.register('/register', 'register');

    expect(router.resolve('/register')).toBe('register');
  });

  it('resolves to the first matching route', () => {
    const router = new Router();
    router.register('/register', 'register');
    router.register('/', 'home');

    expect(router.resolve('/register')).toBe('register');
  });

  it('falls back to home when no route matches', () => {
    const router = new Router();
    router.register('/register', 'register');

    expect(router.resolve('/unknown')).toBe('home');
  });

  it('extracts params from a path pattern against a hash', () => {
    expect(Router.extractParams('/games/:id', '#/games/10')).toEqual({ id: '10' });
  });

  it('extracts params ignoring a query string', () => {
    expect(Router.extractParams('/games/:id', '#/games/10?page=2')).toEqual({ id: '10' });
  });

  it('matches a registered path to its page key', () => {
    const router = new Router();
    router.register('/register', 'register');

    expect(router.match('/register')).toBe('register');
  });

  it('matches null when no route matches', () => {
    const router = new Router();
    router.register('/register', 'register');

    expect(router.match('/unknown')).toBeNull();
  });

  describe('.extractContextParams', () => {
    it('extracts params from a Personal hash', () => {
      expect(Router.extractContextParams('/games/:id', '#/games/10')).toEqual({ id: '10' });
    });

    it('extracts params from an organization hash against the stripped path', () => {
      expect(Router.extractContextParams('/games/:id', '#/orgs/5/games/10?page=2')).toEqual({ id: '10' });
    });

    it('does not strip a malformed organization prefix', () => {
      expect(Router.extractContextParams('/games/:id', '#/orgs/007/games/10')).toEqual({});
    });
  });
});
