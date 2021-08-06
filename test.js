import * as Sentry from './sentry';

Sentry.init(
    '9f96c2f90a5f4beda612b246fb8b6a83',
    'o530932.ingest.sentry.io',
    '5892666'
);

const send = {
    "exception": {
        "values": [{
            "type": "TypeError",
            "value": "demo",
            "stacktrace": {
                "frames": [{
                    "colno": 9,
                    "filename": "http://localhost:3000/main.js",
                    "function": "window.onclick",
                    "in_app": true,
                    "lineno": 12
                }]
            },
            "mechanism": {
                "handled": false,
                "type": "onerror"
            }
        }]
    },
    "platform": "javascript",
    "event_id": "f5bd91ca725b46bab10f883a5f0bd57f",
    "timestamp": 1628178668.806,
    "environment": "production",
    "release": "demo@1.0.0",
    "sdk": {
        "integrations": ["InboundFilters", "FunctionToString", "TryCatch", "Breadcrumbs", "GlobalHandlers", "LinkedErrors", "Dedupe", "UserAgent", "BrowserTracing"],
        "name": "sentry.javascript.browser",
        "version": "6.10.0",
        "packages": [{
            "name": "npm:@sentry/browser",
            "version": "6.10.0"
        }]
    },
    "breadcrumbs": [{
        "timestamp": 1628178651.285,
        "category": "console",
        "data": {
            "arguments": ["[vite] connected."],
            "logger": "console"
        },
        "level": "log",
        "message": "[vite] connected."
    }, {
        "timestamp": 1628178652.277,
        "category": "sentry.transaction",
        "event_id": "5310f5093ff347ab9daa37e14fc0eed9",
        "message": "5310f5093ff347ab9daa37e14fc0eed9"
    }],
    "request": {
        "url": "http://localhost:3000/",
        "headers": {
            "Referer": "http://localhost:3000/",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36"
        }
    }
}

// window.onclick = () => {
//     Promise.resolve().then(() => {
//         HTMLIFrameElement();
//     });
// }