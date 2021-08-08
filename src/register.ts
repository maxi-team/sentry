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
    let event = inner == null && typeof inner.msg === 'string' ? eventFromIncompleteOnError(ev.message, ev.filename, ev.lineno, ev.colno) : enhanceEventWithInitialFrame(eventFromUnknownInput(inner || ev.message, null, false), ev.filename, ev.lineno, ev.colno);
    event = addExceptionMechanism(event, {
      handled: false,
      type: 'onerror'
    });
    dispatch(event);
  });
};

const registerPromise = (dispatch: DispatchEvent) => {
  window.addEventListener('unhandledrejection', (ev) => {
    const safe = ev as SimpleRecord;
    let error = safe;
    try {
      if ('reason' in safe) {
        error = safe.reason;
      } else if ('detail' in ev && 'reason' in safe.detail) {
        error = safe.detail.reason;
      }
    } catch (_oO) {
    // noop
    }
    let event = isPrimitive(error) ? eventFromRejectionWithPrimitive(error) : eventFromUnknownInput(error, null, true);
    event = addExceptionMechanism(event, {
      handled: false,
      type: 'onunhandledrejection'
    });
    dispatch(event);
  });
};

const wrapFunction = (source: SimpleRecord, name: string) => {
  define(source, name, function (this: any, ...args: any[]) {
    const fn = args[0];
    if (fn) {
      define(fn, 'name', name + '(' + getFunctionName(fn) + ')');
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
