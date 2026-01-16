/**
 * Base class for all SDK errors.
 *
 * This class can be used for catching all SDK errors. The error should have
 * translated message in the `message` property that should be shown to the
 * user without any modification.
 *
 * No retries should be done as that is already handled by the SDK.
 *
 * When SDK throws an error and it is not `ProtonDriveError`, it is unhandled error
 * by the SDK and usually indicates bug in the SDK. Please, report it.
 */
export declare class ProtonDriveError extends Error {
    name: string;
}
/**
 * Error thrown when the operation is aborted.
 *
 * This error is thrown when the operation is aborted by the user.
 * For example, by calling `abort()` on the `AbortSignal`.
 */
export declare class AbortError extends ProtonDriveError {
    name: string;
    constructor(message?: string);
}
/**
 * Error thrown when the validation fails.
 *
 * This error is thrown when the validation of the input fails.
 * Validation can be done on the client side or on the server side.
 *
 * For example, on the client, it can be thrown when the node name doesn't
 * follow the required format, etc., while on the server side, it can be thrown
 * when there is not enough permissions, etc.
 */
export declare class ValidationError extends ProtonDriveError {
    name: string;
    /**
     * Internal API code.
     *
     * Use only for debugging purposes.
     */
    readonly code?: number;
    /**
     * Additional details about the error provided by the server.
     */
    readonly details?: object;
    constructor(message: string, code?: number, details?: object);
}
/**
 * Error thrown when the node already exists.
 *
 * This error is thrown when the node with the same name already exists in the
 * parent folder. The client should ask the user to replace the existing node
 * or choose another name. The available name is provided in the `availableName`
 * property (that will contain original name with the index that can be used).
 */
export declare class NodeWithSameNameExistsValidationError extends ValidationError {
    name: string;
    readonly existingNodeUid?: string;
    readonly isUnfinishedUpload: boolean;
    constructor(message: string, code: number, existingNodeUid?: string, isUnfinishedUpload?: boolean);
}
/**
 * Error thrown when the API call fails.
 *
 * This error covers both HTTP errors and API errors. SDK automatically
 * retries the request before the error is thrown. The sepcific algorithm
 * used for retries depends on the type of the error.
 *
 * Client should not retry the request when this error is thrown.
 */
export declare class ServerError extends ProtonDriveError {
    name: string;
    /**
     * HTTP status code of the response.
     *
     * Use only for debugging purposes.
     */
    readonly statusCode?: number;
    /**
     * Internal API code.
     *
     * Use only for debugging purposes.
     */
    readonly code?: number;
}
/**
 * Error thrown when the client makes too many requests to the API.
 *
 * SDK is configured to stay below the rate limits, but it can still happen if
 * client is running multiple SDKs in parallel, or if the rate limits are
 * changed on the server side.
 *
 * SDK automatically retries the request before the error is thrown after
 * waiting for the required time specified by the server.
 *
 * Client should slow down calling SDK when this error is thrown.
 *
 * You can be also notified about the rate limits by the `requestsThrottled`
 * event. See `onMessage` method on the SDK class for more details.
 */
export declare class RateLimitedError extends ServerError {
    name: string;
    code: number;
}
/**
 * Error thrown when the client is not connected to the internet.
 *
 * Client should check the internet connection when this error is thrown.
 *
 * You can also be notified about the connection status by the `offline` event
 * See `onMessage` method on the SDK class for more details.
 */
export declare class ConnectionError extends ProtonDriveError {
    name: string;
}
/**
 * Error thrown when the decryption fails.
 *
 * Client should report this error to the user and report bug report.
 *
 * In most cases, there is no decryption error. Every decryption error should
 * be not exposed but set as empty value on the node, for example. But in the
 * case of the file content, if block cannot be decrypted, decryption error
 * is thrown.
 */
export declare class DecryptionError extends ProtonDriveError {
    name: string;
}
/**
 * Error thrown when the data integrity check fails.
 *
 * Client should report this error to the user and report bug report.
 *
 * For example, it can happen when hashes don't match, etc. In some cases,
 * SDK allows to run command without verification checks for debug purposes.
 */
export declare class IntegrityError extends ProtonDriveError {
    name: string;
    readonly debug?: object;
    constructor(message: string, debug?: object, options?: ErrorOptions);
}
