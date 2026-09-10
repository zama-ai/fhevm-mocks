"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployPauserSet = deployPauserSet;
const PauserSet_js_1 = require("./artifacts/PauserSet.js");
const utils_js_1 = require("./utils.js");
async function deployPauserSet(parameters) {
    const bytecode = (0, utils_js_1.patchTemplateBytecode)({
        template: PauserSet_js_1.template,
        field: 'bytecode',
        replacements: [{ referenceName: 'ACL_ADDRESS', replacement: parameters.aclAddress }],
    });
    return await (0, utils_js_1.sendStep)({
        label: 'PauserSet deploy',
        send: () => parameters.deployer.deploy({ bytecode }),
    });
}
//# sourceMappingURL=pauserSet.js.map