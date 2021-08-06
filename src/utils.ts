import type { BaseClass, Primitive, SimpleRecord } from './types';

export const getLocation = (): string => {
  return location.origin + location.pathname;
};

export const getTransaction = () => {
  return location.hash;
};

export const getReferrer = (): string => {
  return document.referrer || getLocation();
};

export const getUserAgent = (): string => {
  return navigator.userAgent;
};

export const getUser = (): SimpleRecord => {
  const query = location.search.slice(1);

  const params: SimpleRecord = {};

  if (query !== '') {
    let match: RegExpMatchArray | null;
    const paramsRegex = /([\w-]+)=([\w-]+)/g;
    while ((match = paramsRegex.exec(query)) !== null) {
      params[match[1]] = match[2];
    }
  }

  return params;
};

export const getTags = () => {
  return {
    browser_screen: screen.width + 'x' + screen.height,
    browser_language: (navigator.languages && navigator.languages[0]) || navigator.language || (navigator as SimpleRecord).userLanguage || '',
    browser_frame: window.parent !== window ? 'iframe' : 'native'
  };
};

export const getType = ({}).toString;
export const getOwn = ({}).hasOwnProperty;

export const isInstanceOf = (wat: unknown, base: BaseClass) => {
  try {
    return wat instanceof base;
  } catch (_e) {
    return false;
  }
};

export const isNull = (wat?: null | undefined | unknown): wat is null | undefined => wat == null;

export const isError = (wat: unknown) => {
  if (isNull(wat)) {
    return false;
  }
  switch (getType.call(wat)) {
    case '[object Error]':
    case '[object Exception]':
    case '[object DOMException]':
      return true;
    default:
      return isInstanceOf(wat, Error);
  }
};

export const isErrorEvent = (wat: unknown): wat is ErrorEvent => {
  return !isNull(wat) && getType.call(wat) === '[object ErrorEvent]';
};
export const isDOMError = (wat: unknown): wat is DOMError => {
  return !isNull(wat) && getType.call(wat) === '[object DOMError]';
};
export const isDOMException = (wat: unknown): wat is DOMException => {
  return !isNull(wat) && getType.call(wat) === '[object DOMException]';
};

export const isPlainObject = (obj: unknown): obj is Record<string, unknown> => {
  if (typeof obj !== 'object' || isNull(obj)) {
    return false;
  }

  let proto = obj;
  while (!isNull(Object.getPrototypeOf(proto))) {
    proto = Object.getPrototypeOf(proto);
  }

  return Object.getPrototypeOf(obj) === proto;
};

export const isString = (wat: unknown): wat is string => {
  return typeof wat === 'string';
};

export const isPrimitive = (wat: unknown): wat is Primitive => {
  return isNull(wat) || (typeof wat !== 'object' && typeof wat !== 'function');
};

export const isElement = (wat: unknown): wat is Element => {
  return isInstanceOf(wat, Element);
};

export const isEvent = (wat: unknown): wat is Event => {
  return isInstanceOf(wat, Event);
};

export const truncate = (str: string) => {
  const safe = '' + str;
  if (safe.length > 25) {
    return ('' + str).slice(0, 20) + '<...>';
  }
  return safe;
};

export const createSIDPart = () => (Math.random() * 16 | 0).toString(16) + Date.now().toString(16);

export const createSID = () => {
  const version = '4';
  const order = (((Math.random() * 16 | 0) & 0x3) | 0x8).toString(16);

  let part = '';
  while (part.length < 30) {
    part += createSIDPart();
  }
  part = part.slice(0, 12) + version + part.slice(12, 16) + order + part.slice(16, 30);

  return part;
};

export const createDate = () => new Date().toISOString();
export const createTimestamp = () => Date.now() / 1000;
