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
});
