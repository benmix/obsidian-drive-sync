import { ProtonDriveClientContructorParameters } from '../interface';
import { Diagnostic } from './interface';
export type { Diagnostic, DiagnosticOptions, ExpectedTreeNode, DiagnosticProgressCallback, DiagnosticResult, } from './interface';
/**
 * Initializes the diagnostic tool. It creates the instance of
 * ProtonDriveClient with the special probes to observe the logs,
 * metrics and HTTP calls; and enforced null/empty cache to always
 * start from scratch.
 */
export declare function initDiagnostic(options: Omit<ProtonDriveClientContructorParameters, 'entitiesCache' | 'cryptoCache' | 'telemetry'>): Diagnostic;
