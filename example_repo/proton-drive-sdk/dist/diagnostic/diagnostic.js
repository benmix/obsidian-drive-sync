"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Diagnostic = void 0;
const sdkDiagnosticMain_1 = require("./sdkDiagnosticMain");
const sdkDiagnosticPhotos_1 = require("./sdkDiagnosticPhotos");
const zipGenerators_1 = require("./zipGenerators");
/**
 * Diagnostic tool that produces full diagnostic, including logs and metrics
 * by reading the events from the telemetry and HTTP client.
 */
class Diagnostic {
    telemetry;
    httpClient;
    protonDriveClient;
    protonDrivePhotosClient;
    constructor(telemetry, httpClient, protonDriveClient, protonDrivePhotosClient) {
        this.telemetry = telemetry;
        this.httpClient = httpClient;
        this.protonDriveClient = protonDriveClient;
        this.protonDrivePhotosClient = protonDrivePhotosClient;
        this.telemetry = telemetry;
        this.httpClient = httpClient;
        this.protonDriveClient = protonDriveClient;
        this.protonDrivePhotosClient = protonDrivePhotosClient;
    }
    async *verifyMyFiles(options, onProgress) {
        const diagnostic = new sdkDiagnosticMain_1.SDKDiagnosticMain(this.protonDriveClient, options, onProgress);
        yield* this.yieldEvents(diagnostic.verifyMyFiles(options?.expectedStructure));
    }
    async *verifyNodeTree(node, options, onProgress) {
        const diagnostic = new sdkDiagnosticMain_1.SDKDiagnosticMain(this.protonDriveClient, options, onProgress);
        yield* this.yieldEvents(diagnostic.verifyNodeTree(node, options?.expectedStructure));
    }
    async *verifyPhotosTimeline(options, onProgress) {
        const diagnostic = new sdkDiagnosticPhotos_1.SDKDiagnosticPhotos(this.protonDrivePhotosClient, options, onProgress);
        yield* this.yieldEvents(diagnostic.verifyTimeline(options?.expectedStructure));
    }
    async *yieldEvents(generator) {
        yield* (0, zipGenerators_1.zipGenerators)(generator, this.internalGenerator(), { stopOnFirstDone: true });
    }
    async *internalGenerator() {
        yield* (0, zipGenerators_1.zipGenerators)(this.telemetry.iterateEvents(), this.httpClient.iterateEvents());
    }
    async getNodeTreeStructure(node) {
        const diagnostic = new sdkDiagnosticMain_1.SDKDiagnosticMain(this.protonDriveClient);
        return diagnostic.getStructure(node);
    }
    async getPhotosTimelineStructure() {
        const diagnostic = new sdkDiagnosticPhotos_1.SDKDiagnosticPhotos(this.protonDrivePhotosClient);
        return diagnostic.getStructure();
    }
}
exports.Diagnostic = Diagnostic;
//# sourceMappingURL=diagnostic.js.map