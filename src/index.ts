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
  integrations: ['LinkedErrors', 'FunctionToString', 'UserAgent'], // need for feature-detection
  name: 'sentry.javascript.browser',
  version: '6.11.0',
  packages: [{
    name: 'npm:@sentry/browser',
    version: '6.11.0'
  }]
};

let base: SentryEvent = {};

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
  endpoint = 'https://' + sentry_endpoint + '/api/' + sentry_project;

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
        ['Referer']: getReferrer(),
        ['User-Agent']: getUserAgent()
      }
    }
  };

  dispatchInit();
  register(dispatchError);
};
