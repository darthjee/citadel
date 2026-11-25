import React from 'react';
import TodoGate, { TODO_STATUS } from '../../../../../../../assets/js/components/resources/todo/pages/TodoGate.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

const render = (props) => renderedOutput(React.createElement(TodoGate, {
  render: () => React.createElement('p', null, 'CONTENT'),
  ...props,
}));

describe('TodoGate', () => {
  it('renders the content by default', () => {
    expect(render({}).contains('CONTENT')).toBeTrue();
  });

  it('renders Not-found on a not-found status', () => {
    const page = render({ status: TODO_STATUS.NOT_FOUND });

    expect(page.containsElement('h1', 'Not found')).toBeTrue();
    expect(page.contains('CONTENT')).toBeFalse();
  });

  it('renders the permission message on a forbidden status', () => {
    const page = render({ status: TODO_STATUS.FORBIDDEN });

    expect(page.contains('permission')).toBeTrue();
    expect(page.contains('CONTENT')).toBeFalse();
  });

  it('renders the permission message when the role is not allowed, without building the content', () => {
    const content = jasmine.createSpy('render');
    const page = render({ allowed: false, render: content });

    expect(page.contains('permission')).toBeTrue();
    expect(content).not.toHaveBeenCalled();
  });

  it('renders nothing while the role is unknown', () => {
    expect(render({ allowed: null }).isEmpty()).toBeTrue();
  });

  it('lets a not-found status win over an unknown role', () => {
    expect(render({ status: TODO_STATUS.NOT_FOUND, allowed: null }).contains('Not found')).toBeTrue();
  });
});
