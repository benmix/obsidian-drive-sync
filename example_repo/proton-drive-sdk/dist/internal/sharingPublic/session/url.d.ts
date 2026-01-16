/**
 * Parse the token and password from the URL.
 *
 * The URL format is: https://drive.proton.me/urls/token#password
 *
 * @param url - The URL of the public link.
 * @returns The token and password.
 */
export declare function getTokenAndPasswordFromUrl(url: string): {
    token: string;
    password: string;
};
