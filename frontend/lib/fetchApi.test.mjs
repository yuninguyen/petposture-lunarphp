import assert from "node:assert/strict";
import test from "node:test";
import { fetchApi } from "./fetchApi.ts";

test("unsafe API requests bootstrap CSRF and never attach localStorage bearer tokens", async () => {
    const calls = [];
    globalThis.window = { location: { hostname: "localhost" } };
    globalThis.document = { cookie: "" };
    globalThis.localStorage = {
        getItem: () => "exfiltratable-legacy-token",
    };
    globalThis.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        if (String(url).endsWith("/sanctum/csrf-cookie")) {
            globalThis.document.cookie = "XSRF-TOKEN=csrf-value";
            return new Response(null, { status: 204 });
        }

        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    };

    await fetchApi("/api/logout", { method: "POST" });

    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/sanctum\/csrf-cookie$/);
    assert.equal(calls[0].options.credentials, "include");
    assert.equal(calls[1].options.credentials, "include");
    const headers = new Headers(calls[1].options.headers);
    assert.equal(headers.get("Authorization"), null);
    assert.equal(headers.get("X-XSRF-TOKEN"), "csrf-value");
});
