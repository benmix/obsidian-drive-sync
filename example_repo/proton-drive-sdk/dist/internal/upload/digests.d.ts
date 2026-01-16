export declare class UploadDigests {
    private digestSha1;
    constructor(digestSha1?: import("@noble/hashes/utils").Hash<import("@noble/hashes/utils").Hash<any>>);
    update(data: Uint8Array): void;
    digests(): {
        sha1: string;
    };
}
