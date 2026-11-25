import Route from '../../../../../assets/js/utils/routing/Route.js';

describe('Route', () => {
  it('matches static routes', () => {
    const route = new Route('/register', 'register');

    expect(route.matches('/register')).toBe(true);
  });

  it('matches parameterized routes', () => {
    const route = new Route('/games/:id', 'game');

    expect(route.matches('/games/10')).toBe(true);
  });

  it('does not match unrelated paths', () => {
    const route = new Route('/register', 'register');

    expect(route.matches('/other')).toBe(false);
  });

  it('extracts named params from a matching path', () => {
    const route = new Route('/games/:id', 'game');

    expect(route.params('/games/10')).toEqual({ id: '10' });
  });

  it('returns an empty object when the path does not match', () => {
    const route = new Route('/games/:id', 'game');

    expect(route.params('/other')).toEqual({});
  });

  it('exposes the page identifier', () => {
    const route = new Route('/register', 'register');

    expect(route.page).toBe('register');
  });

  it('matches static routes with a trailing slash', () => {
    const route = new Route('/register', 'register');

    expect(route.matches('/register/')).toBe(true);
  });

  it('matches parameterized routes with a trailing slash', () => {
    const route = new Route('/games/:id', 'game');

    expect(route.matches('/games/10/')).toBe(true);
    expect(route.params('/games/10/')).toEqual({ id: '10' });
  });

  it('matches the root route', () => {
    const route = new Route('/', 'home');

    expect(route.matches('/')).toBe(true);
    expect(route.params('/')).toEqual({});
  });

  it('does not match other paths against the root route', () => {
    const route = new Route('/', 'home');

    expect(route.matches('/other')).toBe(false);
  });

  it('does not match an empty param segment', () => {
    const route = new Route('/games/:id', 'game');

    expect(route.matches('/games/')).toBe(false);
    expect(route.matches('/games//')).toBe(false);
    expect(route.params('/games/')).toEqual({});
    expect(route.params('/games//')).toEqual({});
  });

  it('does not match paths with extra segments', () => {
    const route = new Route('/games/:id', 'game');

    expect(route.matches('/games/10/extra')).toBe(false);
  });

  it('does not match paths with missing segments', () => {
    const route = new Route('/games/:id', 'game');

    expect(route.matches('/games')).toBe(false);
  });

  it('extracts a param in the middle of the pattern', () => {
    const route = new Route('/admin/users/:id/edit', 'adminUserEdit');

    expect(route.matches('/admin/users/5/edit')).toBe(true);
    expect(route.params('/admin/users/5/edit')).toEqual({ id: '5' });
  });

  it('extracts multiple params', () => {
    const route = new Route('/games/:gameId/players/:playerId', 'player');

    expect(route.params('/games/3/players/7')).toEqual({ gameId: '3', playerId: '7' });
  });

  it('matches static segments with regex-special characters literally', () => {
    const route = new Route('/v1.0', 'version');

    expect(route.matches('/v1.0')).toBe(true);
    expect(route.matches('/v1x0')).toBe(false);
  });
});
