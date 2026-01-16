/**
 * Split a filename into `[name, extension]`
 */
export declare function splitExtension(filename?: string): [string, string];
/**
 * Join a filename into `name (index).extension`
 */
export declare function joinNameAndExtension(name: string, index: number, extension: string): string;
