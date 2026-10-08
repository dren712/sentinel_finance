import { SENTINEL_IDL } from './idl/sentinel-idl';

export interface SentinelErrorInfo {
  code: number;
  name: string;
  msg: string;
}

export const SENTINEL_ERROR_BY_CODE: Record<number, SentinelErrorInfo> = {};
export const SENTINEL_CODE_BY_NAME: Record<string, number> = {};

for (const err of SENTINEL_IDL.errors) {
  SENTINEL_ERROR_BY_CODE[err.code] = {
    code: err.code,
    name: err.name,
    msg: err.msg,
  };
  SENTINEL_CODE_BY_NAME[err.name] = err.code;
}

export function getSentinelError(codeOrName: number | string): SentinelErrorInfo | undefined {
  if (typeof codeOrName === 'number') {
    return SENTINEL_ERROR_BY_CODE[codeOrName];
  }
  const code = SENTINEL_CODE_BY_NAME[codeOrName];
  return code !== undefined ? SENTINEL_ERROR_BY_CODE[code] : undefined;
}
