import React from 'react';
import { renderedOutput } from './renderedOutput.js';

describe('renderedOutput', () => {
  let Component;

  beforeEach(() => {
    Component = jasmine.createSpy('Component').and.callFake(
      () => React.createElement('p', { className: 'greeting' }, 'Hello'),
    );
  });

  describe('#contains', () => {
    it('is true for text present in the rendered output', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.contains('class="greeting">Hello')).toBeTrue();
    });

    it('is false for text absent from the rendered output', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.contains('Goodbye')).toBeFalse();
    });
  });

  describe('#containsTag', () => {
    it('is true for a tag present in the rendered output', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.containsTag('p')).toBeTrue();
    });

    it('is false for a tag absent from the rendered output', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.containsTag('form')).toBeFalse();
    });
  });

  describe('#containsElement', () => {
    it('is true for text that is the full content of the named element', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.containsElement('p', 'Hello')).toBeTrue();
    });

    it('is false for text absent from the rendered output', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.containsElement('p', 'Goodbye')).toBeFalse();
    });

    it('is false for the same text under a different tag', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.containsElement('span', 'Hello')).toBeFalse();
    });
  });

  describe('#containsAttribute', () => {
    it('is true for an attribute with the given value', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.containsAttribute('class', 'greeting')).toBeTrue();
    });

    it('is false for the attribute with a different value', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.containsAttribute('class', 'farewell')).toBeFalse();
    });

    it('is false for the same value under a different attribute', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.containsAttribute('id', 'greeting')).toBeFalse();
    });
  });

  describe('#containsInOrder', () => {
    let output;

    beforeEach(() => {
      output = renderedOutput(React.createElement(
        'div',
        null,
        React.createElement('h1', null, 'Title'),
        React.createElement('p', null, 'Body'),
        React.createElement('span', null, 'Footer'),
      ));
    });

    it('is true for texts in rendered order', () => {
      expect(output.containsInOrder('Title', 'Body', 'Footer')).toBeTrue();
    });

    it('is false for the same texts out of order', () => {
      expect(output.containsInOrder('Body', 'Title', 'Footer')).toBeFalse();
    });

    it('is false when one of the texts is absent', () => {
      expect(output.containsInOrder('Title', 'Missing', 'Footer')).toBeFalse();
    });
  });

  describe('#isEmpty', () => {
    it('is true for an element that renders nothing', () => {
      const Empty = () => null;
      const output = renderedOutput(React.createElement(Empty));

      expect(output.isEmpty()).toBeTrue();
    });

    it('is false for an element that renders markup', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.isEmpty()).toBeFalse();
    });
  });

  it('renders the element once, however many queries are made', () => {
    const output = renderedOutput(React.createElement(Component));

    output.contains('Hello');
    output.contains('Goodbye');
    output.containsTag('p');
    output.containsElement('p', 'Hello');
    output.containsAttribute('class', 'greeting');
    output.containsInOrder('class', 'Hello');

    expect(Component).toHaveBeenCalledTimes(1);
  });
});
