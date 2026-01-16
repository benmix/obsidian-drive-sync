import { ServerError, ValidationError } from '../../errors';
export declare function apiErrorFactory({ response, result, error, }: {
    response: Response;
    result?: unknown;
    error?: unknown;
}): ServerError;
export declare class APIHTTPError extends ServerError {
    name: string;
    readonly statusCode: number;
    constructor(message: string, statusCode: number);
}
export declare class APICodeError extends ServerError {
    name: string;
    readonly code: number;
    readonly debug?: object;
    constructor(message: string, code: number, debug?: object);
}
export declare class NotFoundAPIError extends ValidationError {
    name: string;
}
export declare class InvalidRequirementsAPIError extends ValidationError {
    name: string;
}
