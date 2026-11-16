import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { config } from '../config.js';
import { AppError, assert } from '../utils/errors.js';
export const sha256 = (value:string) => createHash('sha256').update(value).digest('hex');
export const sessionToken = () => randomBytes(32).toString('base64url');
function encryptionKey():Buffer {
  const key=Buffer.from(config.encryptionKey,'base64');
  if(key.length!==32) throw new AppError(503,'未配置 ENCRYPTION_KEY（需 32 字节 base64）');
  return key;
}
export function encryptSecret(plaintext:string):string {
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const data=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);
  return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.');
}
export function decryptSecret(ciphertext:string):string {
  const parts=ciphertext.split('.');
  if(parts.length!==3) throw new AppError(500,'密钥格式错误');
  const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(parts[0],'base64url'));
  decipher.setAuthTag(Buffer.from(parts[1],'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(parts[2],'base64url')),decipher.final()]).toString('utf8');
}
