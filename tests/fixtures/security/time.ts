export const issuedAt = Date.parse('2026-09-23T12:00:00Z');
export const afterSessionExpiry = issuedAt + 8 * 60 * 60 * 1000 + 1;
export const afterCsrfExpiry = issuedAt + 15 * 60 * 1000 + 1;
