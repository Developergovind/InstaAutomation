export interface StoredMetaToken {
  pageAccessToken: string;
  userAccessToken: string;
  expiresAt: number;
  tokenType: 'PAGE' | 'USER';
  updatedAt: string;
}

export interface MetaDebugTokenResponse {
  data?: {
    app_id?: string;
    type?: string;
    is_valid?: boolean;
    expires_at?: number;
    scopes?: string[];
  };
}

export interface MetaTokenExchangeResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface MetaPageAccount {
  id?: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id?: string };
}

export interface MetaAccountsResponse {
  data?: MetaPageAccount[];
}

export interface MetaTokenStatus {
  valid: boolean;
  tokenType: string;
  expiresAt: number | null;
  expiresInDays: number | null;
  neverExpires: boolean;
  updatedAt: string | null;
  message: string;
}

export interface MetaTokenRefreshResult {
  refreshed: boolean;
  before: MetaTokenStatus;
  after: MetaTokenStatus;
  message: string;
}
