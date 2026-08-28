import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtimeFiles = [
    "../context/AuthContext.tsx",
    "./fetchApi.ts",
    "../proxy.ts",
    "../../admin/src/lib/auth.ts",
    "../../admin/src/lib/api.ts",
    "../../admin/src/App.tsx",
    "../../admin/src/features/auth/LoginPage.tsx",
].map((path) => new URL(path, import.meta.url));

test("storefront and admin auth runtime expose no bearer token storage", () => {
    const source = runtimeFiles.map((file) => readFileSync(file, "utf8")).join("\n");

    assert.doesNotMatch(source, /petposture_(?:admin_)?token/);
    assert.doesNotMatch(source, /petposture_user/);
    assert.doesNotMatch(source, /Authorization\s*[:=]/);
    assert.doesNotMatch(source, /localStorage[^\n]*(?:token|user)/i);
});
