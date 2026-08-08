import HashRouteResolver from '../../../../../assets/js/utils/routing/HashRouteResolver.js';

describe('HashRouteResolver', () => {
  it('no longer resolves the removed register route, falling back to home', () => {
    const resolver = new HashRouteResolver(() => '#/register');

    expect(resolver.getPage()).toBe('home');
  });

  it('no longer resolves the removed login route, falling back to home', () => {
    const resolver = new HashRouteResolver(() => '#/login');

    expect(resolver.getPage()).toBe('home');
  });

  it('no longer resolves the removed recover route, falling back to home', () => {
    const resolver = new HashRouteResolver(() => '#/recover');

    expect(resolver.getPage()).toBe('home');
  });

  it('resolves the reset-password route', () => {
    const resolver = new HashRouteResolver(() => '#/recover-password');

    expect(resolver.getPage()).toBe('reset-password');
  });

  it('resolves the reset-password route with a token query string', () => {
    const resolver = new HashRouteResolver(() => '#/recover-password?token=abc123');

    expect(resolver.getPage()).toBe('reset-password');
  });

  it('resolves the admin-users route', () => {
    const resolver = new HashRouteResolver(() => '#/admin/users');

    expect(resolver.getPage()).toBe('admin-users');
  });

  it('resolves the admin-user-edit route', () => {
    const resolver = new HashRouteResolver(() => '#/admin/users/42/edit');

    expect(resolver.getPage()).toBe('admin-user-edit');
  });

  it('resolves the authorization-requests route', () => {
    const resolver = new HashRouteResolver(() => '#/account/authorization-requests');

    expect(resolver.getPage()).toBe('authorization-requests');
  });

  it('resolves the home route', () => {
    const resolver = new HashRouteResolver(() => '#/');

    expect(resolver.getPage()).toBe('home');
  });

  it('resolves an empty hash to home', () => {
    const resolver = new HashRouteResolver(() => '');

    expect(resolver.getPage()).toBe('home');
  });

  it('resolves an unknown route to home', () => {
    const resolver = new HashRouteResolver(() => '#/unknown');

    expect(resolver.getPage()).toBe('home');
  });

  it('exposes the current hash', () => {
    const resolver = new HashRouteResolver(() => '#/register');

    expect(resolver.currentHash()).toBe('#/register');
  });

  it('defaults to reading window.location.hash', () => {
    const resolver = new HashRouteResolver();

    expect(resolver.currentHash()).toBe('');
  });
});
