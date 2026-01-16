"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const errors_1 = require("../../errors");
const wait_1 = require("../wait");
class UploadController {
    signal;
    paused = false;
    promise;
    constructor(signal) {
        this.signal = signal;
        this.signal = signal;
    }
    async waitWhilePaused() {
        try {
            await (0, wait_1.waitForCondition)(() => !this.paused, this.signal);
        }
        catch (error) {
            if (error instanceof errors_1.AbortError) {
                return;
            }
            throw error;
        }
    }
    pause() {
        this.paused = true;
    }
    resume() {
        this.paused = false;
    }
    async completion() {
        if (!this.promise) {
            throw new Error('UploadController.completion() called before upload started');
        }
        return await this.promise;
    }
}
exports.UploadController = UploadController;
//# sourceMappingURL=controller.js.map