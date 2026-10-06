"use strict";

const Module = require("node:module");
const path = require("node:path");

const stub = path.join(__dirname, "shims", "server-only.js");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return stub;
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
