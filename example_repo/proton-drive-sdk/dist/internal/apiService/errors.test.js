"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../../errors");
const errors_2 = require("./errors");
const errors = __importStar(require("./errors"));
function mockAPIResponseAndResult(options) {
    const { httpStatusCode = 422, httpStatusText = 'Unprocessable Entity', code, message = 'API error' } = options;
    const result = { Code: code, Error: message };
    const response = new Response(JSON.stringify(result), { status: httpStatusCode, statusText: httpStatusText });
    return { response, result };
}
describe('apiErrorFactory should return', () => {
    it('AbortError on aborted error', () => {
        const abortError = new Error('AbortError');
        abortError.name = 'AbortError';
        const error = (0, errors_2.apiErrorFactory)({ response: new Response(), error: abortError });
        expect(error).toBeInstanceOf(errors_1.AbortError);
        expect(error.message).toBe('Request aborted');
    });
    it('generic APIHTTPError when there is no specifc body', () => {
        const response = new Response('', { status: 404, statusText: 'Not found' });
        const error = (0, errors_2.apiErrorFactory)({ response });
        expect(error).toBeInstanceOf(errors.APIHTTPError);
        expect(error.message).toBe('Not found');
        expect(error.statusCode).toBe(404);
    });
    it('generic APIHTTPError with generic message when there is no specifc statusText', () => {
        const response = new Response('', { status: 404, statusText: '' });
        const error = (0, errors_2.apiErrorFactory)({ response });
        expect(error).toBeInstanceOf(errors.APIHTTPError);
        expect(error.message).toBe('Unknown error');
        expect(error.statusCode).toBe(404);
    });
    it('generic APIHTTPError when there 404 both in status code and body code', () => {
        const error = (0, errors_2.apiErrorFactory)(mockAPIResponseAndResult({
            httpStatusCode: 404,
            httpStatusText: 'Path not found',
            code: 404,
            message: 'Not found',
        }));
        expect(error).toBeInstanceOf(errors.APIHTTPError);
        expect(error.message).toBe('Path not found');
        expect(error.statusCode).toBe(404);
    });
    it('generic APICodeError when there is body even if wrong', () => {
        const result = {};
        const response = new Response('', { status: 422 });
        const error = (0, errors_2.apiErrorFactory)({ response, result });
        expectAPICodeError(error, 0, 'Unknown error');
    });
    it('generic APICodeError when there is body but not specific handle', () => {
        const error = (0, errors_2.apiErrorFactory)(mockAPIResponseAndResult({ code: 42, message: 'General error' }));
        expectAPICodeError(error, 42, 'General error');
    });
    it('NotFoundAPIError when code is ErrorCode.NOT_EXISTS', () => {
        const error = (0, errors_2.apiErrorFactory)(mockAPIResponseAndResult({ code: 2501 /* ErrorCode.NOT_EXISTS */, message: 'Not found' }));
        expect(error).toBeInstanceOf(errors.NotFoundAPIError);
        expect(error.message).toBe('Not found');
        expect(error.code).toBe(2501 /* ErrorCode.NOT_EXISTS */);
    });
});
function expectAPICodeError(error, code, message) {
    expect(error).toBeInstanceOf(errors.APICodeError);
    expect(error.message).toBe(message);
    expect(error.code).toBe(code);
}
//# sourceMappingURL=errors.test.js.map