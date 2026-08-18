/**
 * jsdom, plus the platform globals a browser actually has.
 *
 * `jest-environment-jsdom` provides no `fetch`, `Response`, `Headers` or
 * streams, so anything built on the Fetch API - which is the whole point of
 * this control's transport - fails with `Response is not defined` and the test
 * ends up exercising an error path that cannot happen in a real host.
 *
 * This module runs in the Node realm, so `globalThis` here is Node's, and
 * Node 20+ already ships spec-compliant implementations of all of these.
 */
const JSDOMEnvironment = require('jest-environment-jsdom').default;

const PLATFORM_GLOBALS = [
  'fetch',
  'Headers',
  'Request',
  'Response',
  'FormData',
  'Blob',
  'File',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'TextEncoder',
  'TextDecoder',
  'structuredClone',
  'BroadcastChannel',
];

module.exports = class JsdomWithPlatformGlobals extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);

    for (const name of PLATFORM_GLOBALS) {
      if (this.global[name] === undefined && globalThis[name] !== undefined) {
        this.global[name] = globalThis[name];
      }
    }
  }
};
