import type {
  SentryEvent
} from './types.js';

import {
  createDate,
  createSID,
  createTimestamp,
  getLocation,
  getReferrer,
  getTags,
  getTransaction,
  getUser,
  getUserAgent
} from './utils.js';

import {
  register
} from './register.js';

let sid: string;
let key: string;
let endpoint: string;

const sdk = {
  // Need for feature-detection
  integrations: ['LinkedErrors', 'FunctionToString', 'UserAgent'],
  name: 'sentry.javascript.browser',
  version: '6.13.2',
  packages: [{
    name: 'npm:@sentry/browser',
    version: '6.13.2'
  }]
};

let base: SentryEvent = {};

const dispatchSend = (body: string, type: string) => {
  const xhr = new XMLHttpRequest();
  const url = `${endpoint}/${type}/?sentry_version=7&sentry_key=${key}`;

  xhr.open('POST', url, true);
  xhr.responseType = 'json';
  xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
  xhr.send(body);
};

const dispatchStore = (info: SentryEvent) => {
  dispatchSend(JSON.stringify(info), 'store');
};

const dispatchEnvelope = (values: Array<Record<string, unknown>>) => {
  dispatchSend(values.map((value) => JSON.stringify(value)).join('\n'), 'envelope');
};

const dispatchInit = () => {
  const date = createDate();

  dispatchEnvelope([{
    sent_at: date,
    sdk
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
      user_agent: getUserAgent()
    }
  }]);
};

const dispatchError = (event: SentryEvent) => {
  const store: SentryEvent = Object.assign({}, event, base, {
    event_id: createSID(),
    timestamp: createTimestamp(),
    transaction: getTransaction()
  });

  dispatchStore(store);
};

/**
 * From dsn `https://<key>@<endpoint>/<project>`
 *
 * @param sentry_key
 * @param sentry_endpoint
 * @param sentry_project
 */
export const init = (sentry_key: string, sentry_endpoint: string, sentry_project: string) => {
  key = sentry_key;
  endpoint = `https://${sentry_endpoint}/api/${sentry_project}`;

  sid = createSID();

  base = {
    user: getUser(),
    tags: getTags(),

    level: 'error',
    platform: 'javascript',
    environment: 'production',
    sdk,
    request: {
      url: getLocation(),
      headers: {
        'Referer': getReferrer(),
        'User-Agent': getUserAgent()
      }
    }
  };

  dispatchInit();
  register(dispatchError);
};
