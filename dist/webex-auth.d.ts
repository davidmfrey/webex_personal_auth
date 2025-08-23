#!/usr/bin/env node
interface TokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
}
declare class TokenManager {
    private envFilePath;
    private configDir;
    constructor();
    saveToken(token: TokenResponse): Promise<void>;
    validatePersonalToken(token: string): Promise<boolean>;
    displayPersonalTokenInfo(token: string): void;
    getTokenAutomatically(): Promise<void>;
    private isValidTokenFormat;
}
export { TokenManager };
//# sourceMappingURL=webex-auth.d.ts.map