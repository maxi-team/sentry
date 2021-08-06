import * as Sentry from './src/sentry';

// https://81df134e0e324016973b6e42bd269bd5@o947028.ingest.sentry.io/5896227
Sentry.init(
    '81df134e0e324016973b6e42bd269bd5',
    'o947028.ingest.sentry.io',
    '5896227'
);

window.onclick = () => {
    Promise.resolve().then(() => {
      setTimeout(() => FileList.bind(window)());
    });
}
