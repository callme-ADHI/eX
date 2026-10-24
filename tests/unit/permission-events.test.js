import test from "node:test";
import assert from "node:assert/strict";

function reducePermissionEvent(current, event) {
  const next = { ...current };
  if (event.type === "permission_change") {
    next[event.permission] = event.state;
  } else if (event.type === "stream_start") {
    if (event.kind === "video") next.cameraActive = true;
    if (event.kind === "audio") next.micActive = true;
  } else if (event.type === "stream_stop") {
    if (event.kind === "video") next.cameraActive = false;
    if (event.kind === "audio") next.micActive = false;
  }
  return next;
}

test("reducePermissionEvent updates permission states", () => {
  let state = { camera: "prompt", microphone: "prompt" };
  state = reducePermissionEvent(state, { type: "permission_change", permission: "camera", state: "granted" });
  assert.equal(state.camera, "granted");

  state = reducePermissionEvent(state, { type: "permission_change", permission: "geolocation", state: "denied" });
  assert.equal(state.geolocation, "denied");
});

test("reducePermissionEvent tracks active media streams", () => {
  let state = { cameraActive: false, micActive: false };
  state = reducePermissionEvent(state, { type: "stream_start", kind: "video" });
  assert.equal(state.cameraActive, true);

  state = reducePermissionEvent(state, { type: "stream_start", kind: "audio" });
  assert.equal(state.micActive, true);

  state = reducePermissionEvent(state, { type: "stream_stop", kind: "video" });
  assert.equal(state.cameraActive, false);
  assert.equal(state.micActive, true);
});
