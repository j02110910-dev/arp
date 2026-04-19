"use strict";
/**
 * Cognitive Governor - Memory & Context Management
 * Compresses long conversations, anchors critical instructions, stores knowledge
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CognitiveGovernor = exports.getDefaultConfig = exports.loadConfig = void 0;
var config_1 = require("./config");
Object.defineProperty(exports, "loadConfig", { enumerable: true, get: function () { return config_1.loadConfig; } });
Object.defineProperty(exports, "getDefaultConfig", { enumerable: true, get: function () { return config_1.getDefaultConfig; } });
var governor_1 = require("./governor");
Object.defineProperty(exports, "CognitiveGovernor", { enumerable: true, get: function () { return governor_1.CognitiveGovernor; } });
//# sourceMappingURL=index.js.map