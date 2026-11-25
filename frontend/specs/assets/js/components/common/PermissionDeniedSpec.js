import React from 'react';
import PermissionDenied, {
  PERMISSION_DENIED_MESSAGE,
} from '../../../../../assets/js/components/common/PermissionDenied.jsx';
import { renderedOutput } from '../../../../support/renderedOutput.js';

describe('PermissionDenied', () => {
  it('exposes the permission message', () => {
    expect(PERMISSION_DENIED_MESSAGE).toBe("You don't have permission to do this");
  });

  it('renders the permission message as an alert', () => {
    const page = renderedOutput(React.createElement(PermissionDenied));

    expect(page.containsElement('div', 'You don&#x27;t have permission to do this')).toBeTrue();
    expect(page.containsAttribute('role', 'alert')).toBeTrue();
  });
});
