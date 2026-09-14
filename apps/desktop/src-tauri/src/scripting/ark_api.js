// ark API — injected before user scripts
// __ctx_json is a global string set by the Rust host
var __ctx = JSON.parse(__ctx_json);
var __phase = __phase_str; // "pre_request" or "post_response"

var __mutations = {
  env: {},
  globals: {},
  variables: {},
  collectionVariables: {},
  tests: [],
  console: [],
  request: {
    method: __ctx.request.method,
    url: __ctx.request.url,
    headers: Object.assign({}, __ctx.request.headers),
    body: __ctx.request.body
  }
};

// Helper: deep clone a simple value
function __clone(v) {
  if (v === null || v === undefined) return v;
  if (typeof v === "object") return JSON.parse(JSON.stringify(v));
  return v;
}

// --- console ---
var console = {
  log: function() {
    var args = Array.prototype.slice.call(arguments);
    __mutations.console.push({ level: "log", message: args.map(String).join(" ") });
  },
  warn: function() {
    var args = Array.prototype.slice.call(arguments);
    __mutations.console.push({ level: "warn", message: args.map(String).join(" ") });
  },
  error: function() {
    var args = Array.prototype.slice.call(arguments);
    __mutations.console.push({ level: "error", message: args.map(String).join(" ") });
  },
  info: function() {
    var args = Array.prototype.slice.call(arguments);
    __mutations.console.push({ level: "info", message: args.map(String).join(" ") });
  }
};

// --- env/globals/variables stores ---
function __makeStore(source, target) {
  var data = Object.assign({}, source);
  return {
    get: function(k) { return data[k]; },
    set: function(k, v) { data[k] = String(v); target[k] = String(v); },
    unset: function(k) { delete data[k]; target[k] = null; },
    toObject: function() { return Object.assign({}, data); }
  };
}

// --- expect (lightweight Chai-like) ---
function __expect(val) {
  var negate = false;

  function check(pass, msg) {
    if (negate) pass = !pass;
    if (!pass) throw new Error(msg);
  }

  var api = {
    to: null,
    not: null,
    equal: function(exp) {
      check(val === exp, "expected " + JSON.stringify(val) + " to " + (negate ? "not " : "") + "equal " + JSON.stringify(exp));
      return api;
    },
    eql: function(exp) {
      check(JSON.stringify(val) === JSON.stringify(exp), "expected deep equal");
      return api;
    },
    a: function(t) {
      var actual = typeof val;
      if (t === "array") {
        check(Array.isArray(val), "expected " + JSON.stringify(val) + " to be an array");
      } else if (t === "null") {
        check(val === null, "expected null");
      } else {
        check(actual === t, "expected type " + t + " but got " + actual);
      }
      return api;
    },
    include: function(item) {
      if (typeof val === "string") {
        check(val.indexOf(item) !== -1, "expected string to include " + JSON.stringify(item));
      } else if (Array.isArray(val)) {
        check(val.indexOf(item) !== -1, "expected array to include " + JSON.stringify(item));
      } else if (typeof val === "object" && val !== null) {
        check(item in val, "expected object to have key " + JSON.stringify(item));
      } else {
        check(false, "include not supported for " + typeof val);
      }
      return api;
    },
    property: function(prop) {
      check(val != null && typeof val === "object" && prop in val,
        "expected object to have property " + JSON.stringify(prop));
      return api;
    },
    above: function(n) { check(val > n, "expected " + val + " to be above " + n); return api; },
    below: function(n) { check(val < n, "expected " + val + " to be below " + n); return api; },
    least: function(n) { check(val >= n, "expected " + val + " to be at least " + n); return api; },
    most: function(n) { check(val <= n, "expected " + val + " to be at most " + n); return api; },
    lengthOf: function(n) {
      var len = val && val.length;
      check(len === n, "expected length " + n + " but got " + len);
      return api;
    },
    match: function(re) {
      var regex = (typeof re === "string") ? new RegExp(re) : re;
      check(regex.test(val), "expected " + JSON.stringify(val) + " to match " + re);
      return api;
    },
    oneOf: function(list) {
      check(list.indexOf(val) !== -1, "expected " + JSON.stringify(val) + " to be one of " + JSON.stringify(list));
      return api;
    },
    exist: null
  };

  // Boolean-style assertions accessed as getters via to.be.*
  var be = {
    a: api.a,
    an: api.a,
    above: api.above,
    below: api.below
  };

  // Define getter properties on be
  Object.defineProperty(be, "true", { get: function() { check(val === true, "expected true"); return api; } });
  Object.defineProperty(be, "false", { get: function() { check(val === false, "expected false"); return api; } });
  Object.defineProperty(be, "null", { get: function() { check(val === null, "expected null"); return api; } });
  Object.defineProperty(be, "undefined", { get: function() { check(val === undefined, "expected undefined"); return api; } });
  Object.defineProperty(be, "ok", { get: function() { check(!!val, "expected truthy value"); return api; } });
  Object.defineProperty(be, "empty", { get: function() {
    if (typeof val === "string" || Array.isArray(val)) check(val.length === 0, "expected empty");
    else if (typeof val === "object" && val !== null) check(Object.keys(val).length === 0, "expected empty object");
    else check(false, "empty not supported for " + typeof val);
    return api;
  }});

  var have = {
    property: api.property,
    lengthOf: api.lengthOf
  };

  var to = {
    equal: api.equal,
    eql: api.eql,
    deep: { equal: api.eql },
    be: be,
    have: have,
    include: api.include,
    match: api.match,
    a: api.a,
    an: api.a,
    oneOf: api.oneOf,
    not: null
  };

  // to.not flips negate
  Object.defineProperty(to, "not", { get: function() { negate = !negate; return to; } });
  Object.defineProperty(api, "to", { get: function() { return to; } });
  Object.defineProperty(api, "not", { get: function() { negate = !negate; return api; } });

  // exist as getter on api
  Object.defineProperty(api, "exist", { get: function() {
    check(val !== null && val !== undefined, "expected value to exist");
    return api;
  }});

  return api;
}

// --- ark object ---
var ark = {
  request: {
    get url() { return __mutations.request.url; },
    get method() { return __mutations.request.method; },
    get headers() { return Object.assign({}, __mutations.request.headers); },
    get body() { return __mutations.request.body; },
    setUrl: function(u) {
      if (__phase !== "pre_request") throw new Error("Cannot modify request in post-response phase");
      __mutations.request.url = String(u);
    },
    setMethod: function(m) {
      if (__phase !== "pre_request") throw new Error("Cannot modify request in post-response phase");
      __mutations.request.method = String(m).toUpperCase();
    },
    setHeader: function(k, v) {
      if (__phase !== "pre_request") throw new Error("Cannot modify request in post-response phase");
      __mutations.request.headers[k] = String(v);
    },
    removeHeader: function(k) {
      if (__phase !== "pre_request") throw new Error("Cannot modify request in post-response phase");
      delete __mutations.request.headers[k];
    },
    setBody: function(b) {
      if (__phase !== "pre_request") throw new Error("Cannot modify request in post-response phase");
      __mutations.request.body = (b === null || b === undefined) ? null : String(b);
    }
  },
  response: __ctx.response ? {
    get status() { return __ctx.response.status; },
    get statusText() { return __ctx.response.statusText; },
    get headers() { return Object.assign({}, __ctx.response.headers); },
    get body() { return __ctx.response.body; },
    get time() { return __ctx.response.timeMs; },
    get size() { return __ctx.response.sizeBytes; },
    json: function() { return JSON.parse(__ctx.response.body); },
    text: function() { return __ctx.response.body; }
  } : null,
  env: __makeStore(__ctx.env, __mutations.env),
  globals: __makeStore(__ctx.globals, __mutations.globals),
  variables: __makeStore(__ctx.variables, __mutations.variables),
  collectionVariables: __makeStore(__ctx.collectionVariables, __mutations.collectionVariables),
  test: function(name, fn) {
    try {
      fn();
      __mutations.tests.push({ name: name, passed: true, error: null });
    } catch(e) {
      __mutations.tests.push({ name: name, passed: false, error: e.message || String(e) });
    }
  },
  expect: __expect
};

// --- Expose result for Rust to extract ---
// __result_json will be read after script execution
