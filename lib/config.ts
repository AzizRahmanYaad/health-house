/**
 * Central configuration — read once from the environment.
 * Mirrors config/config.php of the PHP portal.
 */
export const APP_NAME        = process.env.APP_NAME        || 'Health House';
export const APP_SHORT       = process.env.APP_SHORT       || 'Health House';
export const APP_INSTITUTION = process.env.APP_INSTITUTION || 'Midwifery Education';
export const APP_TIMEZONE    = process.env.APP_TIMEZONE    || 'Asia/Kabul';

/** Upload limit in bytes (200 MB by default). */
export const MAX_UPLOAD_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || '', 10) || 200 * 1024 * 1024;

/** Where uploaded files live on disk (relative to the project unless absolute). Served back through /uploads/... */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export const SESSION_COOKIE = 'hh_session';
export const FLASH_COOKIE   = 'hh_flash';

export const SESSION_SECRET = process.env.SESSION_SECRET || 'health-house-development-secret-change-me';

export const IS_DEV = process.env.NODE_ENV !== 'production';
