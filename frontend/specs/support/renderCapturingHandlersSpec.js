import { renderCapturingHandlers } from './renderCapturingHandlers.js';

describe('renderCapturingHandlers', () => {
  const handlers = { onSubmit: jasmine.createSpy('onSubmit') };
  let Helper;
  let Page;

  beforeEach(() => {
    Helper = { render: () => null };
    Page = () => Helper.render({ state: true }, handlers);
  });

  it('returns the handlers passed to Helper.render', () => {
    expect(renderCapturingHandlers(Page, Helper)).toBe(handlers);
  });

  it('renders the page through Helper.render exactly once', () => {
    renderCapturingHandlers(Page, Helper);

    expect(Helper.render).toHaveBeenCalledTimes(1);
  });

  it('stubs Helper.render with a fake div', () => {
    renderCapturingHandlers(Page, Helper);

    const rendered = Helper.render.calls.mostRecent().returnValue;

    expect(rendered.type).toBe('div');
  });
});
