export type Result<T, E> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
export declare function resultOk<T, E>(value: T): Result<T, E>;
export declare function resultError<T, E>(error: E): Result<T, E>;
