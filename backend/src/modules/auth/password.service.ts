import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: 16_384, r: 8, p: 1 }, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

@Injectable()
export class PasswordService {
  /** 使用内置 scrypt 保存可移植的密码格式，避免保存明文或可逆密钥。 */
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('base64url');
    const derivedKey = await deriveKey(password, salt);
    return `scrypt$${salt}$${derivedKey.toString('base64url')}`;
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const [algorithm, salt, encodedKey] = encodedHash.split('$');
    if (algorithm !== 'scrypt' || !salt || !encodedKey) return false;

    try {
      const expectedKey = Buffer.from(encodedKey, 'base64url');
      const actualKey = await deriveKey(password, salt);
      return (
        expectedKey.length === actualKey.length &&
        timingSafeEqual(expectedKey, actualKey)
      );
    } catch {
      return false;
    }
  }
}
