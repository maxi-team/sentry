import type {
  DispatchEvent,
  SimpleRecord
} from './types.js';

import {
  addExceptionMechanism,
  enhanceEventWithInitialFrame,
  eventFromIncompleteOnError,
  eventFromRejectionWithPrimitive,
  eventFromUnknownInput
} from './sentry.js';

import {
  define,
  getFunctionName,
  isPrimitive,
  isRecord
} from './utils.js';

const registerError = (dispatch: DispatchEvent) => {
  window.addEventListener('error', (ev) => {
    try {
      const inner = ev.error;

      let event = inner == null && typeof ev.message === 'string' ?
        eventFromIncompleteOnError(ev.message, ev.filename, ev.lineno, ev.colno) :
        enhanceEventWithInitialFrame(eventFromUnknownInput(inner || ev.message, null, false), ev.filename, ev.lineno, ev.colno);

      event = addExceptionMechanism(event, {
        handled: false,
        type: 'onerror'
      });

      dispatch(event);
    } catch {
      // Noop
    }
  });
};

const registerPromise = (dispatch: DispatchEvent) => {
  window.addEventListener('unhandledrejection', (ev) => {
    try {
      let error = ev as SimpleRecord;

      if (isRecord(error)) {
        if ('reason' in error) {
          error = error.reason;
        } else if ('detail' in error && 'reason' in error.detail) {
          error = error.detail.reason;
        } else {
          // As-is
        }
      }

      let event = isPrimitive(error) ?
        eventFromRejectionWithPrimitive(error) :
        eventFromUnknownInput(error, null, true);

      event = addExceptionMechanism(event, {
        handled: false,
        type: 'onunhandledrejection'
      });

      dispatch(event);
    } catch {
      // Noop
    }
  });
};

const wrapFunction = (source: SimpleRecord, name: string) => {
  define(source, name, function(this: unknown) {
    const fn = arguments[0];

    if (fn) {
      define(fn as SimpleRecord, 'name', `${name}(${getFunctionName(fn)})`);
    }

    return source[name].apply(this, arguments);
  });
};

const registerAsync = () => {
  const source = window as SimpleRecord;

  wrapFunction(source, 'setTimeout');
  wrapFunction(source, 'setInterval');
  wrapFunction(source, 'requestAnimationFrame');
};

export const register = (dispatch: DispatchEvent) => {
  registerAsync();
  registerError(dispatch);
  registerPromise(dispatch);
};
