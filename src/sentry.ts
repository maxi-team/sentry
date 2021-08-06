import type {
  ExtendedError,
  SentryEvent,
  SentryException,
  SentryStackFrame,
  StackTrace,
  TraceKitStackFrame,
  TraceKitStackTrace,
  SimpleNode,
  SimpleEvent,
  SentryEventException,
  SimpleRecord
} from './types';

import {
  createDate,
  createSID,
  getLocation,
  getOwn,
  getReferrer,
  getType,
  getUserAgent,
  isDOMError,
  isDOMException,
  isElement,
  isError,
  isErrorEvent,
  isEvent,
  isInstanceOf,
  isNull,
  isPlainObject,
  isPrimitive,
  isString,
  normalizeToSize,
  truncate
} from './utils';

const addExceptionBase = (event: SentryEvent): SentryEventException => {
  const base = event as SentryEventException;
  base.exception = base.exception || {};
  base.exception.values = base.exception.values || [];
  base.exception.values[0] = base.exception.values[0] || {};
  return base;
};

const addExceptionTypeValue = (event: SentryEvent, value?: string, type?: string): SentryEventException => {
  const base = addExceptionBase(event);
  base.exception.values[0].value = base.exception.values[0].value || value || '';
  base.exception.values[0].type = base.exception.values[0].type || type || 'Error';
  return base;
};

const addExceptionMechanism = (event: SentryEvent, mechanism: SimpleRecord): SentryEventException => {
  const base = addExceptionBase(event);
  base.exception.values[0].mechanism = base.exception.values[0].mechanism || {};
  for (const key in mechanism) {
    base.exception.values[0].mechanism[key] = mechanism[key];
  }
  return base;
};

const UNKNOWN_FUNCTION = '?';

const chrome = /^\s*at (?:(.*?) ?\()?((?:file|https?|blob|chrome-extension|address|native|eval|webpack|<anonymous>|[-a-z]+:|.*bundle|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
const gecko = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:file|https?|blob|chrome|webpack|resource|moz-extension|capacitor).*?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i;
const winjs = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i;
const geckoEval = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
const chromeEval = /\((\S*)(?::(\d+))(?::(\d+))\)/;

const reactMinifiedRegexp = /Minified React error #\d+;/i;
const opera10Regex = / line (\d+).*script (?:in )?(\S+)(?:: in function (\S+))?$/i;
const opera11Regex = / line (\d+), column (\d+)\s*(?:in (?:<anonymous function: ([^>]+)>|([^)]+))\((.*)\))? in (.*):\s*$/i;

const ERROR_TYPES_RE = /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/i;

const computeStackTrace = (ex:SimpleRecord): StackTrace => {
  let stack = null;
  let popSize = 0;

  if (ex) {
    if (typeof ex.framesToPop === 'number') {
      popSize = ex.framesToPop;
    } else if (reactMinifiedRegexp.test(ex.message as string)) {
      popSize = 1;
    }
  }

  try {
    stack = computeStackTraceFromStacktraceProp(ex);
    if (stack) {
      return popFrames(stack, popSize);
    }
  } catch {
    // noop
  }

  try {
    stack = computeStackTraceFromStackProp(ex);
    if (stack) {
      return popFrames(stack, popSize);
    }
  } catch {
    // noop
  }

  return {
    message: extractMessage(ex),
    name: ex && (ex.name as string) || '<unknown>',
    stack: [],
    failed: true
  };
};

const computeStackTraceFromStackProp = (ex: SimpleRecord): StackTrace | null => {
  if (!ex || !ex.stack) {
    return null;
  }

  const stack = [];
  const lines = (ex.stack as string).split('\n');
  let isEval;
  let submatch;
  let parts;
  let element;

  for (let i = 0; i < lines.length; ++i) {
    if ((parts = chrome.exec(lines[i]))) {
      const isNative = parts[2] && parts[2].startsWith('native');
      isEval = parts[2] && parts[2].startsWith('eval');
      if (isEval && (submatch = chromeEval.exec(parts[2]))) {

        parts[2] = submatch[1];
        parts[3] = submatch[2];
        parts[4] = submatch[3];
      }

      let url = parts[2] && parts[2].startsWith('address at ') ? parts[2].slice('address at '.length) : parts[2];
      let func = parts[1] || UNKNOWN_FUNCTION;
      const isSafariExtension = func.indexOf('safari-extension') !== -1;
      const isSafariWebExtension = func.indexOf('safari-web-extension') !== -1;
      if (isSafariExtension || isSafariWebExtension) {
        func = func.indexOf('@') !== -1 ? func.split('@')[0] : UNKNOWN_FUNCTION;
        url = isSafariExtension ? `safari-extension:${url}` : `safari-web-extension:${url}`;
      }

      element = {
        url,
        func,
        args: isNative ? [parts[2]] : [],
        line: parts[3] ? +parts[3] : null,
        column: parts[4] ? +parts[4] : null
      };
    } else if ((parts = winjs.exec(lines[i]))) {
      element = {
        url: parts[2],
        func: parts[1] || UNKNOWN_FUNCTION,
        args: [],
        line: +parts[3],
        column: parts[4] ? +parts[4] : null
      };
    } else if ((parts = gecko.exec(lines[i]))) {
      isEval = parts[3] && parts[3].indexOf(' > eval') > -1;
      if (isEval && (submatch = geckoEval.exec(parts[3]))) {

        parts[1] = parts[1] || `eval`;
        parts[3] = submatch[1];
        parts[4] = submatch[2];
        parts[5] = '';
      } else if (i === 0 && !parts[5] && ex.columnNumber !== undefined) {
        stack[0].column = (ex.columnNumber as number) + 1;
      }
      element = {
        url: parts[3],
        func: parts[1] || UNKNOWN_FUNCTION,
        args: parts[2] ? parts[2].split(',') : [],
        line: parts[4] ? +parts[4] : null,
        column: parts[5] ? +parts[5] : null
      };
    } else {
      continue;
    }

    if (!element.func && element.line) {
      element.func = UNKNOWN_FUNCTION;
    }

    stack.push(element);
  }

  if (!stack.length) {
    return null;
  }

  return {
    message: extractMessage(ex),
    name: (ex.name as string) || '<unknown>',
    stack
  };
};


const computeStackTraceFromStacktraceProp = (ex: SimpleRecord): StackTrace | null => {
  if (!ex || !ex.stacktrace) {
    return null;
  }

  const lines = (ex.stacktrace as string).split('\n');
  const stack = [];
  let parts;

  for (let line = 0; line < lines.length; line += 2) {
    let element = null;
    if ((parts = opera10Regex.exec(lines[line]))) {
      element = {
        url: parts[2],
        func: parts[3],
        args: [],
        line: +parts[1],
        column: null
      };
    } else if ((parts = opera11Regex.exec(lines[line]))) {
      element = {
        url: parts[6],
        func: parts[3] || parts[4],
        args: parts[5] ? parts[5].split(',') : [],
        line: +parts[1],
        column: +parts[2]
      };
    }

    if (element) {
      if (!element.func && element.line) {
        element.func = UNKNOWN_FUNCTION;
      }
      stack.push(element);
    }
  }

  if (!stack.length) {
    return null;
  }

  return {
    message: extractMessage(ex),
    name: (ex.name as string) || '<unknown>',
    stack
  };
};

const popFrames = (stacktrace: StackTrace, popSize: number): StackTrace => {
  try {
    return Object.assign(stacktrace, stacktrace.stack.slice(popSize));
  } catch (e) {
    return stacktrace;
  }
};

const htmlElementAsString = (el: unknown): string => {
  const elem = el as Element | SVGElement;

  let out = '';

  if (!elem || !elem.tagName) {
    return out;
  }

  out += elem.tagName.toLowerCase();

  const id = elem.id;
  if (id) {
    out += '#' + id;
  }

  let className = elem.className;
  if (className) {
    if (typeof className === 'object' && className.baseVal) {
      className = className.baseVal;
    }
    out += className.split(/\s+/).join('.');
  }

  return out;
};

const htmlTreeAsString = (elem: SimpleNode): string => {
  try {
    let currentElem = elem;
    const MAX_TRAVERSE_HEIGHT = 5;
    const MAX_OUTPUT_LEN = 80;
    let out = '';
    let height = 0;
    let len = 0;
    const separator = ' > ';
    const sepLength = separator.length;
    let nextStr;
    while (currentElem && height++ < MAX_TRAVERSE_HEIGHT) {
      nextStr = htmlElementAsString(currentElem);

      if (nextStr === 'html' || (height > 1 && len + out.length * sepLength + nextStr.length >= MAX_OUTPUT_LEN)) {
        break;
      }

      out = nextStr + separator + out;

      len += nextStr.length;
      currentElem = currentElem.parentNode;
    }

    return out;
  } catch (_oO) {
    return '<unknown>';
  }
};

const getWalkSource = (value: SimpleRecord): SimpleRecord => {
  if (isError(value)) {
    const error = value as unknown as ExtendedError;
    const err: SimpleRecord = {
      message: error.message,
      name: error.name,
      stack: error.stack
    };

    for (const i in error) {
      if (getOwn.call(error, i)) {
        err[i] = error[i];
      }
    }

    return err;
  }

  if (isEvent(value)) {
    const event = value as unknown as SimpleEvent;
    const source: SimpleRecord = {};

    source.type = event.type;

    try {
      source.target = isElement(event.target)
        ? htmlTreeAsString(event.target)
        : getType.call(event.target);
    } catch (_oO) {
      source.target = '<unknown>';
    }

    try {
      source.currentTarget = isElement(event.currentTarget)
        ? htmlTreeAsString(event.currentTarget)
        : getType.call(event.currentTarget);
    } catch (_oO) {
      source.currentTarget = '<unknown>';
    }

    if (typeof CustomEvent !== 'undefined' && isInstanceOf(value, CustomEvent)) {
      source.detail = event.detail;
    }

    for (const i in event) {
      if (getOwn.call(event, i)) {
        source[i] = event;
      }
    }

    return source;
  }

  return value;
};

const extractExceptionKeysForMessage = (exception: SimpleRecord): string => {
  const keys = Object.keys(getWalkSource(exception));
  keys.sort();

  if (!keys.length) {
    return '[object has no keys]';
  }

  if (keys[0].length >= 20) {
    return truncate(keys[0]);
  }

  for (let includedKeys = keys.length; includedKeys > 0; includedKeys--) {
    const serialized = keys.slice(0, includedKeys).join(', ');
    if (serialized.length > 20) {
      continue;
    }
    if (includedKeys === keys.length) {
      return serialized;
    }
    return truncate(serialized);
  }

  return '';
};

const extractMessage = (ex: SimpleRecord): string => {
  const message = ex && ex.message;
  if (!message) {
    return 'No error message';
  }
  if (message.error && typeof message.error.message === 'string') {
    return message.error.message;
  }
  return message;
};

const exceptionFromStacktrace = (stacktrace: TraceKitStackTrace): SentryException => {
  const frames = prepareFramesForEvent(stacktrace.stack);

  const exception: SentryException = {
    type: stacktrace.name,
    value: stacktrace.message
  };

  if (frames && frames.length) {
    exception.stacktrace = { frames };
  }

  if (isNull(exception.type) && exception.value === '') {
    exception.value = 'Unrecoverable error caught';
  }

  return exception;
};

const eventFromPlainObject = (exception: SimpleRecord, syntheticException?: Error, rejection?: boolean): SentryEvent => {
  const event: SentryEvent = {
    exception: {
      values: [{
        type: isEvent(exception) ? exception.constructor.name : rejection ? 'UnhandledRejection' : 'Error',
        value: `Non-Error ${
          rejection ? 'promise rejection' : 'exception'
        } captured with keys: ${extractExceptionKeysForMessage(exception)}`
      }]
    },
    extra: {
      __serialized__: normalizeToSize(exception)
    }
  };

  if (syntheticException) {
    const stacktrace = computeStackTrace(syntheticException);
    const frames = prepareFramesForEvent(stacktrace.stack);
    event.stacktrace = {
      frames
    };
  }

  return event;
};

const eventFromStacktrace = (stacktrace: TraceKitStackTrace): SentryEvent => {
  const exception = exceptionFromStacktrace(stacktrace);

  return {
    exception: {
      values: [exception]
    }
  };
};

const prepareFramesForEvent = (stack: TraceKitStackFrame[]): SentryStackFrame[] => {
  if (!stack || !stack.length) {
    return [];
  }

  let localStack = stack;

  const firstFrameFunction = localStack[0].func || '';
  const lastFrameFunction = localStack[localStack.length - 1].func || '';

  if (firstFrameFunction.indexOf('captureMessage') !== -1 || firstFrameFunction.indexOf('captureException') !== -1) {
    localStack = localStack.slice(1);
  }

  if (lastFrameFunction.indexOf('sentryWrapped') !== -1) {
    localStack = localStack.slice(0, -1);
  }

  return localStack
    .slice(0, 20)
    .map(
      (frame: TraceKitStackFrame): SentryStackFrame => ({
        colno: frame.column === null ? undefined : frame.column,
        filename: frame.url || localStack[0].url,
        function: frame.func || '?',
        in_app: true,
        lineno: frame.line === null ? undefined : frame.line
      })
    )
    .reverse();
};

const eventFromUnknownInput = (exception: unknown, syntheticException?: Error, rejection?: boolean): SentryEvent =>{
  let event: SentryEvent;

  if (isErrorEvent(exception) && exception.error) {
    const errorEvent = exception as ErrorEvent;

    exception = errorEvent.error;
    event = eventFromStacktrace(computeStackTrace(exception as Error));
    return event;
  }
  if (isDOMError(exception as DOMError) || isDOMException(exception as DOMException)) {
    const domException = exception as DOMException;
    const name = domException.name || (isDOMError(domException) ? 'DOMError' : 'DOMException');
    const message = domException.message ? `${name}: ${domException.message}` : name;

    event = eventFromString(message, syntheticException);
    event = addExceptionTypeValue(event, message);
    if ('code' in domException) {
      event.tags = Object.assign(event.tags, {
        'DOMException.code': `${domException.code}`
      });
    }

    return event;
  }
  if (isError(exception)) {
    event = eventFromStacktrace(computeStackTrace(exception as SimpleRecord));
    return event;
  }
  if (isPlainObject(exception) || isEvent(exception)) {
    const objectException = exception as Record<string, unknown>;
    event = eventFromPlainObject(objectException, syntheticException, rejection);
    event = addExceptionMechanism(event, {
      synthetic: true
    });
    return event;
  }

  event = eventFromString(exception as string, syntheticException);
  event = addExceptionTypeValue(event, `${exception}`, undefined);
  event = addExceptionMechanism(event, {
    synthetic: true
  });

  return event;
};

const eventFromString = (input: string, syntheticException?: Error): SentryEvent => {
  const event: SentryEvent = {
    message: input
  };

  if (true && syntheticException) {
    const stacktrace = computeStackTrace(syntheticException);
    const frames = prepareFramesForEvent(stacktrace.stack);
    event.stacktrace = {
      frames
    };
  }

  return event;
};

const enhanceEventWithInitialFrame =  (event: SentryEvent, url?: string, line?: number | string, column?: number | string): SentryEventException => {
  const base = addExceptionBase(event);
  base.exception.values[0].stacktrace = base.exception.values[0].stacktrace || {};
  base.exception.values[0].stacktrace.frames = base.exception.values[0].stacktrace.frames || [];
  const colno = isNull(column) ? 0 : +column || 0;
  const lineno = isNull(line) ? 0 : +line || 0;
  const filename = isString(url) && url.length > 0 ? url : getLocation();
  if (base.exception.values[0].stacktrace.frames.length === 0) {
    base.exception.values[0].stacktrace.frames.push({
      colno,
      filename,
      function: '?',
      in_app: true,
      lineno
    });
  }
  return base;
};

const eventFromIncompleteOnError = (msg: ErrorEvent | string, url?: string, line?: number | string, column?: number | string) => {
  let message = isErrorEvent(msg) ? msg.message : msg;
  let name;
  const groups = message.match(ERROR_TYPES_RE);
  if (groups) {
    name = groups[1];
    message = groups[2];
  }
  const event = {
    exception: {
      values: [{
        type: name || 'Error',
        value: message
      }]
    }
  };
  return enhanceEventWithInitialFrame(event, url, line, column);
};

const eventFromRejectionWithPrimitive = (reason: unknown) => {
  return {
    exception: {
      values: [{
        type: 'UnhandledRejection',
        value: 'Non-Error promise rejection captured with value: ' + String(reason)
      }]
    }
  };
};

let sid: string;
let key: string;
let endpoint: string;

const dispatchSend = async (body: string, type: string) => {
  return fetch(endpoint + '/' + type + '/?sentry_version=7&sentry_key=' + key, {
    method: 'POST',
    body,
    headers: {
      ['Accept']: 'application/json',
      ['Content-Type']: 'text/plain;charset=UTF-8'
    }
  }).then(async (response) => response.json());
};

const dispatchStore = async (info: SentryEvent) => {
  return dispatchSend(JSON.stringify(info), 'store');
};

const dispatchEnvelope = async (values: Array<Record<string, unknown>>) => {
  return dispatchSend(values.map((value) => JSON.stringify(value)).join('\n'), 'envelope');
};

const dispatchInit = () => {
  const date = createDate();

  dispatchEnvelope([{
    sent_at: date,
    sdk: {
      name: 'sentry.javascript.browser',
      version: '6.10.0'
    }
  }, {
    type: 'session'
  }, {
    sid,
    init: true,
    started: date,
    timestamp: date,
    status: 'ok',
    errors: 0,
    attrs: {
      release: 'sentry@0.0.0',
      user_agent: getUserAgent()
    }
  }]);
};

const dispatchError = (e: SentryEvent) => {
  const info: SentryEvent = {
    'platform': 'javascript',
    'environment': 'production',
    'sdk': {
      'integrations': ['InboundFilters', 'FunctionToString', 'TryCatch', 'GlobalHandlers', 'LinkedErrors', 'Dedupe', 'UserAgent'],
      'name': 'sentry.javascript.browser',
      'version': '6.10.0',
      'packages': [{
        'name': 'npm:@sentry/browser',
        'version': '6.10.0'
      }]
    },
    'request': {
      'url': getLocation(),
      'headers': {
        'Referer': getReferrer(),
        'User-Agent': getUserAgent()
      }
    }
  };

  dispatchStore(Object.assign(e, info));
};

/**
 * From dsn `https:
 *
 * @param sentry_key
 * @param sentry_endpoint
 * @param sentry_project
 */
export const init = (sentry_key: string, sentry_endpoint: string, sentry_project: string) => {
  key = sentry_key;
  endpoint = 'https://' + sentry_endpoint + '/api/' + sentry_project;

  sid = createSID();

  dispatchInit();
};

window.addEventListener('error', (ev) => {
  const inner = ev.error;
  let event = inner == null && isString(inner.msg) ? eventFromIncompleteOnError(ev.message, ev.filename, ev.lineno, ev.colno) : enhanceEventWithInitialFrame(eventFromUnknownInput(inner || ev.message, undefined, false), ev.filename, ev.lineno, ev.colno);
  event = addExceptionMechanism(event, {
    handled: false,
    type: 'onerror'
  });
  dispatchError(event);
});

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
  let event = isPrimitive(error) ? eventFromRejectionWithPrimitive(error) : eventFromUnknownInput(error, undefined, true);
  event = addExceptionMechanism(event, {
    handled: false,
    type: 'onunhandledrejection'
  });
  dispatchError(event);
});



