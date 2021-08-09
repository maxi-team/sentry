import type {
  SimpleRecord,
  DispatchEvent
} from './types.js';

import {
  addExceptionMechanism,
  enhanceEventWithInitialFrame,
  eventFromIncompleteOnError,
  eventFromRejectionWithPrimitive,
  eventFromUnknownInput
} from './sentry.js';

import {
  isPrimitive,
  getFunctionName,
  define
} from './utils.js';

const registerError = (dispatch: DispatchEvent) => {
  window.addEventListener('error', (ev) => {
    const inner = ev.error;

    let event = inner == null && typeof ev.message === 'string' ?
      eventFromIncompleteOnError(ev.message, ev.filename, ev.lineno, ev.colno) :
      enhanceEventWithInitialFrame(eventFromUnknownInput(inner || ev.message, null, false), ev.filename, ev.lineno, ev.colno);

    event = addExceptionMechanism(event, {
      handled: false,
      type: 'onerror'
    });

    dispatch(event);
  });
};

const registerPromise = (dispatch: DispatchEvent) => {
  window.addEventListener('unhandledrejection', (ev) => {
    let error = ev as SimpleRecord;
    try {
      if ('reason' in error) {
        error = error.reason;
      } else if ('detail' in ev && 'reason' in error.detail) {
        error = error.detail.reason;
      }
    } catch {
      // noop
    }

    let event = isPrimitive(error) ?
      eventFromRejectionWithPrimitive(error) :
      eventFromUnknownInput(error, null, true);

    event = addExceptionMechanism(event, {
      handled: false,
      type: 'onunhandledrejection'
    });

    dispatch(event);
  });
};

const wrapFunction = (source: SimpleRecord, name: string) => {
  define(source, name, function (this: unknown, ...args: unknown[]) {
    const fn = args[0];
    if (fn) {
      define(fn as SimpleRecord, 'name', name + '(' + getFunctionName(fn) + ')');
    }
    return source[name].apply(this, args);
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
