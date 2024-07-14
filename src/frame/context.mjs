import * as polyfill from "./polyfill/index.mjs";

const internal = {
  location: null,
  self: null,
  globalThis: null
};

class CustomCTX {
  set location(value) {this.location.assign(value)}
  get location() {return internal.location}

  set self(value) {internal.self = value}
  get self() {return internal.self}
  set globalThis(value) {internal.globalThis = value}
  get globalThis() {return internal.globalThis}

  get window() {return this}
  get origin() {return this.location.origin}

  fetch() {return polyfill.fetch(...arguments)}
}

export const ctx = new CustomCTX();

function wrap_function(key) {
  let target = window[key];
  let hidden_sym = Symbol();
  ctx[key] = function() {
    if (this && this[hidden_sym]) return new target(...arguments);
    return target(...arguments);
  }
  Object.setPrototypeOf(ctx[key], target);
  if (target.prototype) ctx[key].prototype = target.prototype;
  ctx[key].prototype[hidden_sym] = true; 
}

export function update_ctx() {
  internal.location = new polyfill.FakeLocation();
  internal.self = ctx;
  internal.globalThis = ctx;

  //wrap function calls
  let ctx_proto = Object.getPrototypeOf(ctx);
  let window_keys = Reflect.ownKeys(window).concat(Object.keys(EventTarget.prototype));
  for (let key of window_keys) {
    if (ctx_proto.hasOwnProperty(key)) continue;
    try {
      if (typeof window[key] === "function") {
        wrap_function(key);
        continue;
      }
      ctx[key] = window[key];
    }
    catch (e) {
      console.error(key, e);
    }
  }

  //wrap window events
  for (let key of Reflect.ownKeys(window)) {
    if (!key.startsWith("on")) continue;
    Object.defineProperty(ctx, key, {
      get: () => {return window[key]},
      set: (value) => {window[key] = value}
    });
  }
}

export function convert_url(url, base) {
  let url_obj = new URL(url, base);
  return url_obj.href;
}

export function run_script(js, this_obj=ctx) {
  return Reflect.apply(Function("globalThis", `
    with (globalThis) {
      ${js}
    }
  `), this_obj, [ctx]);
}