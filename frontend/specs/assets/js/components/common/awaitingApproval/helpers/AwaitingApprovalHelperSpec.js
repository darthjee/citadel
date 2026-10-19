import AwaitingApprovalHelper from '../../../../../../../assets/js/components/common/awaitingApproval/helpers/AwaitingApprovalHelper.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('AwaitingApprovalHelper', () => {
  let handlers;

  const renderView = (state) => renderedOutput(AwaitingApprovalHelper.render(state, handlers));

  const buttons = (element) => {
    const found = [];
    const walk = (node) => {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (!node || typeof node !== 'object') {
        return;
      }
      if (node.props?.onClick) {
        found.push(node);
      }
      walk(node.props?.children);
    };

    walk(element);
    return found;
  };

  beforeEach(() => {
    handlers = {
      onCheckAgain: jasmine.createSpy('onCheckAgain'),
      onLogout: jasmine.createSpy('onLogout'),
    };
  });

  describe('.render', () => {
    it('renders the title and text', () => {
      const view = renderView({ error: null });

      expect(view.containsElement('h1', 'Awaiting approval')).toBeTrue();
      expect(view.contains('Your account is waiting for an administrator&#x27;s approval.')).toBeTrue();
    });

    it('renders the Check again and Log out buttons', () => {
      const view = renderView({ error: null });

      expect(view.containsInOrder('Check again', 'Log out')).toBeTrue();
      expect(view.containsTag('button')).toBeTrue();
    });

    it('wires the buttons to their handlers', () => {
      const [checkAgain, logout] = buttons(AwaitingApprovalHelper.render({ error: null }, handlers));

      checkAgain.props.onClick();
      logout.props.onClick();

      expect(handlers.onCheckAgain).toHaveBeenCalled();
      expect(handlers.onLogout).toHaveBeenCalled();
    });

    it('renders the error when present', () => {
      const view = renderView({ error: 'Could not check' });

      expect(view.contains('Could not check')).toBeTrue();
      expect(view.contains('alert-danger')).toBeTrue();
    });

    it('renders no error alert without an error', () => {
      expect(renderView({ error: null }).contains('alert-danger')).toBeFalse();
    });
  });
});
