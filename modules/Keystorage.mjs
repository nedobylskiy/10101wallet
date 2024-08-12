import Crypto from './Crypto.mjs';
import LocalStorage from './LocalStorage.mjs';

class Keystorage {
    /**
     * Encrypts and saves a key to local storage.
     * @param {string} key - The key to be encrypted and saved.
     * @param {string} password - The password used for encryption.
     * @param {string} [accountName='mainAccount'] - The name of the account under which the key is saved.
     * @returns {Promise<string>} - A promise that resolves with the encrypted key.
     */
    static async save(key, password, accountName = 'mainAccount') {
        let encryptedKey = await this.encryptKey(key, password);
        await LocalStorage.setItem(`encryptedKey_${accountName}`, encryptedKey);
        return encryptedKey;
    }

    /**
     * Loads and decrypts a key from local storage.
     * @param {string} password - The password used for decryption.
     * @param {string} [accountName='mainAccount'] - The name of the account under which the key is saved.
     * @returns {Promise<string>} - A promise that resolves with the decrypted key.
     */
    static async load(password, accountName = 'mainAccount') {
        let encryptedKey = await LocalStorage.getItem(`encryptedKey_${accountName}`);
        return await this.decryptKey(encryptedKey, password);
    }

    /**
     * Retrieves an encrypted account from local storage.
     * @param {string} [accountName='mainAccount'] - The name of the account under which the key is saved.
     * @returns {Promise<string>} - A promise that resolves with the encrypted key.
     */
    static async getEncryptedAccount(accountName = 'mainAccount') {
        return LocalStorage.getItem(`encryptedKey_${accountName}`);
    }

    /**
     * Sets an encrypted account in local storage.
     * @param {string} encryptedKey - The encrypted key to be stored.
     * @param {string} password - The password used for encryption.
     * @param {string} [accountName='mainAccount'] - The name of the account under which the key is saved.
     */
    static async setEncryptedAccount(encryptedKey, password, accountName = 'mainAccount') {
        await LocalStorage.setItem(`encryptedKey_${accountName}`, encryptedKey);
    }

    /**
     * Removes an encrypted account from local storage.
     * @param {string} [accountName='mainAccount'] - The name of the account to be removed.
     */
    static async removeEncryptedAccount(accountName = 'mainAccount') {
        await LocalStorage.removeItem(`encryptedKey_${accountName}`);
    }

    /**
     * Changes the password of an encrypted account.
     * @param {string} oldPassword - The current password.
     * @param {string} newPassword - The new password.
     * @param {string} [accountName='mainAccount'] - The name of the account for which the password is being changed.
     * @returns {Promise<string>} - A promise that resolves with the new encrypted key.
     */
    static async changeEncryptedAccountPassword(oldPassword, newPassword, accountName = 'mainAccount') {
        let encryptedKey = await LocalStorage.getItem(`encryptedKey_${accountName}`);
        let key = await this.decryptKey(encryptedKey, oldPassword);
        let newEncryptedKey = await this.encryptKey(key, newPassword);
        await LocalStorage.setItem(`encryptedKey_${accountName}`, newEncryptedKey);
        return newEncryptedKey;
    }

    /**
     * Encrypts a key using the specified password.
     * @param {string} key - The key to be encrypted.
     * @param {string} password - The password used for encryption.
     * @returns {Promise<string>} - A promise that resolves with the encrypted key.
     */
    static async encryptKey(key, password) {
        let crypto = new Crypto();
        let encryptedKey = await crypto.encrypt(key, password);
        return encryptedKey.toString();
    }

    /**
     * Decrypts a key using the specified password.
     * @param {string} encryptedKey - The encrypted key to be decrypted.
     * @param {string} password - The password used for decryption.
     * @returns {Promise<string>} - A promise that resolves with the decrypted key.
     * @throws {Error} - Throws an error if the decryption fails (e.g., due to an invalid password).
     */
    static async decryptKey(encryptedKey, password) {
        let crypto = new Crypto();
        let decryptedKey = await crypto.decrypt(encryptedKey, password);
        if (decryptedKey.length === 0) {  // Adjusted check for empty decrypted key
            throw new Error('Invalid password');
        }
        return decryptedKey;
    }
}

export default Keystorage;
