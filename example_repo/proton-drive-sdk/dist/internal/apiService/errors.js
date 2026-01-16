"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidRequirementsAPIError = exports.NotFoundAPIError = exports.APICodeError = exports.APIHTTPError = void 0;
exports.apiErrorFactory = apiErrorFactory;
const ttag_1 = require("ttag");
const errors_1 = require("../../errors");
function apiErrorFactory({ response, result, error, }) {
    if (error && error instanceof Error && error.name === 'AbortError') {
        return new errors_1.AbortError((0, ttag_1.c)('Error').t `Request aborted`);
    }
    // Backend responses with 404 both in the response and body code.
    // In such a case we want to stick to APIHTTPError to be very clear
    // it is not NotFoundAPIError.
    if (response.status === 404 /* HTTPErrorCode.NOT_FOUND */ || !result) {
        const fallbackMessage = error instanceof Error ? error.message : (0, ttag_1.c)('Error').t `Unknown error`;
        const apiHttpError = new APIHTTPError(response.statusText || fallbackMessage, response.status);
        apiHttpError.cause = error;
        return apiHttpError;
    }
    const typedResult = result;
    const [code, message, details] = [
        typedResult.Code || 0,
        typedResult.Error || (0, ttag_1.c)('Error').t `Unknown error`,
        typedResult.Details,
    ];
    const debug = typedResult.Exception
        ? {
            details: typedResult.Details,
            exception: typedResult.Exception,
            message: typedResult.message,
            file: typedResult.file,
            line: typedResult.line,
            trace: typedResult.trace,
        }
        : undefined;
    switch (code) {
        case 2501 /* ErrorCode.NOT_EXISTS */:
            return new NotFoundAPIError(message, code, details);
        // ValidationError should be only when it is clearly user input error,
        // otherwise it should be ServerError.
        // Here we convert only general enough codes. Specific cases that are
        // not clear from the code itself must be handled by each module
        // separately.
        case 2000 /* ErrorCode.INVALID_REQUIREMENTS */:
            return new InvalidRequirementsAPIError(message, code, details);
        case 2001 /* ErrorCode.INVALID_VALUE */:
        case 2011 /* ErrorCode.NOT_ENOUGH_PERMISSIONS */:
        case 2026 /* ErrorCode.NOT_ENOUGH_PERMISSIONS_TO_GRANT_PERMISSIONS */:
        case 2500 /* ErrorCode.ALREADY_EXISTS */:
        case 200001 /* ErrorCode.INSUFFICIENT_QUOTA */:
        case 200002 /* ErrorCode.INSUFFICIENT_SPACE */:
        case 200003 /* ErrorCode.MAX_FILE_SIZE_FOR_FREE_USER */:
        case 200004 /* ErrorCode.MAX_PUBLIC_EDIT_MODE_FOR_FREE_USER */:
        case 200100 /* ErrorCode.INSUFFICIENT_VOLUME_QUOTA */:
        case 200101 /* ErrorCode.INSUFFICIENT_DEVICE_QUOTA */:
        case 200201 /* ErrorCode.ALREADY_MEMBER_OF_SHARE_IN_VOLUME_WITH_ANOTHER_ADDRESS */:
        case 200300 /* ErrorCode.TOO_MANY_CHILDREN */:
        case 200301 /* ErrorCode.NESTING_TOO_DEEP */:
        case 200600 /* ErrorCode.INSUFFICIENT_INVITATION_QUOTA */:
        case 200601 /* ErrorCode.INSUFFICIENT_SHARE_QUOTA */:
        case 200602 /* ErrorCode.INSUFFICIENT_SHARE_JOINED_QUOTA */:
        case 200800 /* ErrorCode.INSUFFICIENT_BOOKMARKS_QUOTA */:
            return new errors_1.ValidationError(message, code, details);
        default:
            return new APICodeError(message, code, debug || details);
    }
}
class APIHTTPError extends errors_1.ServerError {
    name = 'APIHTTPError';
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.APIHTTPError = APIHTTPError;
class APICodeError extends errors_1.ServerError {
    name = 'APICodeError';
    code;
    debug;
    constructor(message, code, debug) {
        super(message);
        this.code = code;
        this.debug = debug;
    }
}
exports.APICodeError = APICodeError;
class NotFoundAPIError extends errors_1.ValidationError {
    name = 'NotFoundAPIError';
}
exports.NotFoundAPIError = NotFoundAPIError;
class InvalidRequirementsAPIError extends errors_1.ValidationError {
    name = 'InvalidRequirementsAPIError';
}
exports.InvalidRequirementsAPIError = InvalidRequirementsAPIError;
//# sourceMappingURL=errors.js.map