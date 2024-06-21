import Crypto from './Crypto.mjs';
import LocalStorage from "./LocalStorage.mjs";

class Keystorage {
    static async save(key, password, accountName = 'mainAccount') {
        let encryptedKey = await this.encryptKey(key, password);
        LocalStorage.setItem(`ecryptedKey_${accountName}`, encryptedKey);

        return encryptedKey;
    }

    static async load(password, accountName = 'mainAccount') {
        let encryptedKey = LocalStorage.getItem(`ecryptedKey_${accountName}`);
        return await this.decryptKey(encryptedKey, password);
    }

    static async getEncryptedAccount(accountName = 'mainAccount') {
        return LocalStorage.getItem(`ecryptedKey_${accountName}`);
    }

    static async setEcryptedAccount(encryptedKey, password, accountName = 'mainAccount') {
        LocalStorage.setItem(`ecryptedKey_${accountName}`, encryptedKey);
    }

    static async encryptKey(key, password) {
        let crypto = new Crypto();
        let encryptedKey = await crypto.encrypt(key, password);
        return encryptedKey.toString();
    }

    static async decryptKey(key, password) {
        let crypto = new Crypto();
        let decryptedKey = await crypto.decrypt(key, password);
        if (decryptedKey.sigBytes === 0) {
            throw new Error('Invalid password');
        }

        return decryptedKey;
    }
}

export default Keystorage;
