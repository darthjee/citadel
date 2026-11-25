import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useCan from '../../../../../../../assets/js/components/common/ownerContext/hooks/useCan.js';
import { OwnerContext } from '../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { ACTIONS } from '../../../../../../../assets/js/utils/permissions/orgPermissions.js';

describe('useCan', () => {
  let captured;

  const Probe = ({ action }) => {
    captured = useCan(action);
    return null;
  };

  const renderWithRole = (role, action) => {
    renderToStaticMarkup(createElement(
      OwnerContext.Provider,
      { value: { role } },
      createElement(Probe, { action }),
    ));

    return captured;
  };

  beforeEach(() => {
    captured = undefined;
  });

  it('allows an action the role ranks for', () => {
    expect(renderWithRole('admin', ACTIONS.RENAME_ORGANIZATION)).toBeTrue();
  });

  it('denies an action the role does not rank for', () => {
    expect(renderWithRole('user', ACTIONS.DELETE)).toBeFalse();
  });

  it('allows writing for a user', () => {
    expect(renderWithRole('user', ACTIONS.WRITE)).toBeTrue();
  });

  it('denies everything while the role is unknown', () => {
    expect(renderWithRole(null, ACTIONS.WRITE)).toBeFalse();
  });

  it('denies an unknown action', () => {
    expect(renderWithRole('owner', 'launch_rockets')).toBeFalse();
  });

  it('denies everything outside any provider', () => {
    renderToStaticMarkup(createElement(Probe, { action: ACTIONS.WRITE }));

    expect(captured).toBeFalse();
  });
});
