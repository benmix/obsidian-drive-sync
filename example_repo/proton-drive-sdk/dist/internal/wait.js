"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForCondition = waitForCondition;
exports.waitSeconds = waitSeconds;
exports.wait = wait;
const errors_1 = require("../errors");
const WAIT_TIME = 50;
function waitForCondition(callback, signal) {
    return new Promise((resolve, reject) => {
        const waitForCondition = () => {
            if (signal?.aborted) {
                return reject(new errors_1.AbortError());
            }
            if (callback()) {
                return resolve();
            }
            setTimeout(waitForCondition, WAIT_TIME);
        };
        waitForCondition();
    });
}
async function waitSeconds(seconds) {
    return wait(seconds * 1000);
}
async function wait(miliseconds) {
    return new Promise((resolve) => setTimeout(resolve, miliseconds));
}
//# sourceMappingURL=wait.js.map