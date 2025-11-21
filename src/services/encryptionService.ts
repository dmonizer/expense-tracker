// Encryption Service using Web Crypto API
// Implements AES-GCM encryption for backup data

import { logger } from '../utils';

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 12 bytes for GCM
const SALT_LENGTH = 16;

/**
 * Derive a cryptographic key from a password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    // Derive AES-GCM key
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as BufferSource,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt data using AES-GCM
 * @returns Object containing encrypted data (base64), IV (base64), and salt (base64)
 */
export async function encryptData(
    data: string,
    password: string
): Promise<{ encrypted: string; iv: string; salt: string }> {
    try {
        // Generate random salt and IV
        const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

        // Derive key from password
        const key = await deriveKey(password, salt);

        // Encode data
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);

        // Encrypt
        const encryptedBuffer = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv,
                tagLength: 128,
            },
            key,
            dataBuffer
        );

        // Convert to base64 for storage/transmission
        // Use chunk-based conversion to avoid stack overflow with large data
        const encryptedArray = new Uint8Array(encryptedBuffer);
        let binaryString = '';
        const chunkSize = 8192; // Process 8KB at a time
        for (let i = 0; i < encryptedArray.length; i += chunkSize) {
            const chunk = encryptedArray.subarray(i, Math.min(i + chunkSize, encryptedArray.length));
            binaryString += String.fromCharCode(...chunk);
        }
        const encrypted = btoa(binaryString);

        // IV and salt are small, safe to use spread operator
        const ivBase64 = btoa(String.fromCharCode(...iv));
        const saltBase64 = btoa(String.fromCharCode(...salt));

        logger.info('[Encryption] Data encrypted successfully', {
            dataSize: data.length,
            encryptedSize: encrypted.length,
        });

        return {
            encrypted,
            iv: ivBase64,
            salt: saltBase64,
        };
    } catch (error) {
        logger.error('[Encryption] Failed to encrypt data:', error);
        throw new Error('Encryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * Decrypt data using AES-GCM
 * @returns Decrypted data as string
 */
export async function decryptData(
    encrypted: string,
    iv: string,
    salt: string,
    password: string
): Promise<string> {
    try {
        // Convert from base64
        const encryptedBuffer = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
        const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
        const saltBuffer = Uint8Array.from(atob(salt), c => c.charCodeAt(0));

        // Derive key from password
        const key = await deriveKey(password, saltBuffer);

        // Decrypt
        const decryptedBuffer = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: ivBuffer,
                tagLength: 128,
            },
            key,
            encryptedBuffer
        );

        // Decode data
        const decoder = new TextDecoder();
        const decrypted = decoder.decode(decryptedBuffer);

        logger.info('[Encryption] Data decrypted successfully', {
            encryptedSize: encrypted.length,
            decryptedSize: decrypted.length,
        });

        return decrypted;
    } catch (error) {
        logger.error('[Encryption] Failed to decrypt data:', error);
        throw new Error('Decryption failed: ' + (error instanceof Error ? error.message : 'Invalid encryption key or corrupted data'));
    }
}

/**
 * Validate that a password can decrypt the given encrypted data
 */
export async function validateEncryptionKey(
    encrypted: string,
    iv: string,
    salt: string,
    password: string
): Promise<boolean> {
    try {
        await decryptData(encrypted, iv, salt, password);
        return true;
    } catch {
        return false;
    }
}
