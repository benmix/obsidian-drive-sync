import { PrivateKey, SessionKey } from '../../crypto';
import { DecryptedRevision } from '../nodes';
import { DownloadAPIService } from './apiService';
import { DownloadController } from './controller';
import { DownloadCryptoService } from './cryptoService';
import { BufferedSeekableStream } from './seekableStream';
import { DownloadTelemetry } from './telemetry';
export declare class FileDownloader {
    private telemetry;
    private apiService;
    private cryptoService;
    private nodeKey;
    private revision;
    private signal?;
    private onFinish?;
    private ignoreManifestVerification;
    private logger;
    private controller;
    private nextBlockIndex;
    private ongoingDownloads;
    constructor(telemetry: DownloadTelemetry, apiService: DownloadAPIService, cryptoService: DownloadCryptoService, nodeKey: {
        key: PrivateKey;
        contentKeyPacketSessionKey: SessionKey;
    }, revision: DecryptedRevision, signal?: AbortSignal | undefined, onFinish?: (() => void) | undefined, ignoreManifestVerification?: boolean);
    getClaimedSizeInBytes(): number | undefined;
    getSeekableStream(): BufferedSeekableStream;
    private downloadDataFromPosition;
    downloadToStream(stream: WritableStream, onProgress?: (downloadedBytes: number) => void): DownloadController;
    unsafeDownloadToStream(stream: WritableStream, onProgress?: (downloadedBytes: number) => void): DownloadController;
    private internalDownloadToStream;
    private downloadBlock;
    private downloadBlockData;
    private waitForDownloadCapacity;
    private flushCompletedBlocks;
    private get downloadPromises();
    private get ongoingDownloadPromises();
    private get isNextBlockDownloaded();
}
