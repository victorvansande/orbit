var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var MAX_BYTES = 512 * 1024;
var HISTORY = 20;
var ACK_TTL = 10 * 60 * 1e3;
var ALLOWED_ORIGINS = ["https://victorvansande.github.io"];
var CHANNEL = /^[0-9a-f]{32}$/;
function cors(request) {
  const origin = request.headers.get("Origin") || "";
  const ok = ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
__name(cors, "cors");
var json = /* @__PURE__ */ __name((data, request, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors(request) } }), "json");
var src_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") return json({ ok: true, app: "orbit-sync" }, request);
    const m = url.pathname.match(/^\/v1\/([^/]+)(\/ack)?$/);
    if (!m || !CHANNEL.test(m[1])) return json({ error: "onbekend kanaal" }, request, 404);
    const stub = env.CHANNELS.get(env.CHANNELS.idFromName(m[1]));
    const res = await stub.fetch(request);
    if (res.status === 101) return res;
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors(request))) out.headers.set(k, v);
    return out;
  }
};
var Channel = class {
  static {
    __name(this, "Channel");
  }
  constructor(state) {
    this.state = state;
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }
  async current() {
    return await this.state.storage.get("snap") || { v: 0, d: null };
  }
  async store(d) {
    const prev = await this.current();
    const next = { v: prev.v + 1, d, at: Date.now() };
    const history = await this.state.storage.get("history") || [];
    if (prev.d) history.unshift({ v: prev.v, d: prev.d, at: prev.at });
    await this.state.storage.put({ snap: next, history: history.slice(0, HISTORY) });
    return next;
  }
  async acks() {
    const list = await this.state.storage.get("acks") || [];
    return list.filter((a) => Date.now() - a.at < ACK_TTL);
  }
  async addAck(d) {
    const list = [{ d, at: Date.now() }, ...await this.acks()].slice(0, 10);
    await this.state.storage.put("acks", list);
  }
  broadcast(message, except = null) {
    const text = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(text);
      } catch {
      }
    }
  }
  async fetch(request) {
    const url = new URL(request.url);
    const isAck = url.pathname.endsWith("/ack");
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]);
      const snap = await this.current();
      pair[1].send(JSON.stringify({ t: "snap", v: snap.v, d: snap.d }));
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (request.method === "GET") {
      const snap = await this.current();
      return Response.json({ v: snap.v, d: snap.d, acks: await this.acks() }, { headers: { "Cache-Control": "no-store" } });
    }
    if (request.method === "PUT" || request.method === "POST" && isAck) {
      const body = await request.text();
      if (body.length > MAX_BYTES) return Response.json({ error: "te groot" }, { status: 413 });
      let d;
      try {
        d = JSON.parse(body).d;
      } catch {
        return Response.json({ error: "ongeldig" }, { status: 400 });
      }
      if (typeof d !== "string" || !d) return Response.json({ error: "ongeldig" }, { status: 400 });
      if (isAck) {
        await this.addAck(d);
        this.broadcast({ t: "ack", d });
        return new Response(null, { status: 204 });
      }
      const snap = await this.store(d);
      this.broadcast({ t: "snap", v: snap.v, d });
      return Response.json({ v: snap.v });
    }
    return Response.json({ error: "niet toegestaan" }, { status: 405 });
  }
  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > MAX_BYTES) return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof msg?.d !== "string" || !msg.d) return;
    if (msg.t === "pub") {
      const snap = await this.store(msg.d);
      ws.send(JSON.stringify({ t: "ok", v: snap.v }));
      this.broadcast({ t: "snap", v: snap.v, d: msg.d }, ws);
    } else if (msg.t === "ack") {
      await this.addAck(msg.d);
      this.broadcast({ t: "ack", d: msg.d }, ws);
    }
  }
  webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1e3 : code, "dicht");
    } catch {
    }
  }
  webSocketError() {
  }
};

// ../../../../tmp/claude-0/-home-user/2800b2dd-1d9e-553e-aca1-fe7e93636361/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../tmp/claude-0/-home-user/2800b2dd-1d9e-553e-aca1-fe7e93636361/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-xXrj58/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../tmp/claude-0/-home-user/2800b2dd-1d9e-553e-aca1-fe7e93636361/scratchpad/wr/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-xXrj58/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  Channel,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
