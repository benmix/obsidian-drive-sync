"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObserverStream = void 0;
class ObserverStream extends TransformStream {
    constructor(fn) {
        super({
            transform(chunk, controller) {
                fn?.(chunk);
                controller.enqueue(chunk);
            },
        });
    }
}
exports.ObserverStream = ObserverStream;
//# sourceMappingURL=observerStream.js.map