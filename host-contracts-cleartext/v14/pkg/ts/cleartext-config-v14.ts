// PROVISIONAL, hand-written from internal/cleartext-config.provisional.json — becomes generated when v14 is
// wired in and sdk/cleartext-config.json scopes these constants to v14 (plan section 6). The constants only
// v14's contracts have a field for; the shared cleartext-config.ts reaches every generation and must not
// carry them. Import-free and browser-safe like the shared face: nothing but `export const` literals.

export const CLEARTEXT_KMS_NODE_MPC_IDENTITY_PREFIX = 'kms-core-';

export const CLEARTEXT_KMS_NODE_MPC_IDENTITY_INFIX = '-cleartext-core-';

export const CLEARTEXT_KMS_NODE_PUBLIC_STORAGE_PREFIX = 'cleartext-';

export const CLEARTEXT_KMS_SOFTWARE_VERSION = '0.0.0-cleartext';

export const CLEARTEXT_KMS_NODE_CA_CERT = '0x';
