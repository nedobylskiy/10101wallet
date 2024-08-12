import CryptoJS from 'crypto-js';

const JsonFormatter = {
    stringify: function (cipherParams) {
        // Create JSON object with ciphertext
        let jsonObj = { ct: cipherParams.ciphertext.toString(CryptoJS.enc.Base64) };

        // Optionally add iv (initialization vector) or salt
        if (cipherParams.iv) {
            jsonObj.iv = cipherParams.iv.toString(CryptoJS.enc.Hex); // Convert IV to hexadecimal string
        }

        if (cipherParams.salt) {
            jsonObj.s = cipherParams.salt.toString(CryptoJS.enc.Hex); // Convert salt to hexadecimal string
        }

        // Return JSON string
        return JSON.stringify(jsonObj);
    },
    parse: function (jsonStr) {
        // Parse JSON string
        let jsonObj = JSON.parse(jsonStr);

        // Extract ciphertext from JSON object and create CipherParams object
        let cipherParams = CryptoJS.lib.CipherParams.create({
            ciphertext: CryptoJS.enc.Base64.parse(jsonObj.ct)
        });

        // Optionally extract IV or salt
        if (jsonObj.iv) {
            cipherParams.iv = CryptoJS.enc.Hex.parse(jsonObj.iv);
        }

        if (jsonObj.s) {
            cipherParams.salt = CryptoJS.enc.Hex.parse(jsonObj.s);
        }

        return cipherParams;
    }
};

/**
 * Crypto module based on CryptoJS
 */
class Crypto {
    constructor() {
        // Optionally initialize additional properties or configurations
    }

    /**
     * Encrypts a given text using AES encryption.
     * @param {string} text - The text to encrypt.
     * @param {string} key - The encryption key.
     * @returns {Promise<string>} - A promise that resolves to the encrypted text.
     */
    async encrypt(text, key) {
        // Perform AES encryption and format the result using JsonFormatter
        return CryptoJS.AES.encrypt(text, key, { format: JsonFormatter }).toString();
    }

    /**
     * Decrypts an encrypted text using AES decryption.
     * @param {string} encryptedData - The encrypted text.
     * @param {string} key - The decryption key.
     * @returns {Promise<string>} - A promise that resolves to the decrypted text.
     */
    async decrypt(encryptedData, key) {
        // Perform AES decryption and convert the result to a UTF-8 string
        return CryptoJS.AES.decrypt(encryptedData, key, { format: JsonFormatter }).toString(CryptoJS.enc.Utf8);
    }
}

export default Crypto;
