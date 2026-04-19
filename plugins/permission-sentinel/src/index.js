"use strict";
/**
 * Permission Sentinel - Security Firewall
 * Checks agent actions and sanitizes sensitive data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionSentinel = exports.getDefaultConfig = exports.loadConfig = void 0;
var config_1 = require("./config");
Object.defineProperty(exports, "loadConfig", { enumerable: true, get: function () { return config_1.loadConfig; } });
Object.defineProperty(exports, "getDefaultConfig", { enumerable: true, get: function () { return config_1.getDefaultConfig; } });
var sentinel_1 = require("./sentinel");
Object.defineProperty(exports, "PermissionSentinel", { enumerable: true, get: function () { return sentinel_1.PermissionSentinel; } });
//# sourceMappingURL=index.js.map