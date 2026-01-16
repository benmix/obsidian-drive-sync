"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadController = void 0;
const errors_1 = require("../../errors");
const wait_1 = require("../wait");
class DownloadController {
    signal;
    paused = false;
    promise;
    _isDownloadCompleteWithSignatureIssues = false;
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
        await this.promise;
    }
    isDownloadCompleteWithSignatureIssues() {
        return this._isDownloadCompleteWithSignatureIssues;
    }
    setIsDownloadCompleteWithSignatureIssues(value) {
        this._isDownloadCompleteWithSignatureIssues = value;
    }
}
exports.DownloadController = DownloadController;
//# sourceMappingURL=controller.js.map