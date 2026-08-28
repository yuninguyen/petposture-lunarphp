import assert from "node:assert/strict";
import test from "node:test";
import { buildPreviewQuery } from "./preview-query.ts";

test("forwards only Laravel signed-route preview parameters", () => {
    assert.equal(
        buildPreviewQuery({ expires: "1893456000", signature: "abc+/=" }),
        "expires=1893456000&signature=abc%2B%2F%3D",
    );
    assert.equal(
        buildPreviewQuery({ expires: "1893456000", preview_token: "legacy-token" }),
        undefined,
    );
    assert.equal(buildPreviewQuery({ signature: "missing-expiry" }), undefined);
});
