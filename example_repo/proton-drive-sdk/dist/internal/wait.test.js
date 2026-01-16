"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wait_1 = require("./wait");
describe('waitForCondition', () => {
    it('should resolve immediately if condition is met', async () => {
        const callback = jest.fn().mockReturnValue(true);
        await (0, wait_1.waitForCondition)(callback);
        expect(callback).toHaveBeenCalled();
    });
    it('should resolve after condition is met', async () => {
        const callback = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
        await (0, wait_1.waitForCondition)(callback);
        expect(callback).toHaveBeenCalledTimes(2);
    });
    it('should reject if signal is aborted', async () => {
        const signal = { aborted: true };
        const callback = jest.fn().mockReturnValue(false);
        await expect((0, wait_1.waitForCondition)(callback, signal)).rejects.toThrow('aborted');
    });
});
//# sourceMappingURL=wait.test.js.map