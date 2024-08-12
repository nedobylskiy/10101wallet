import IndexedDBKeyValueStore from "./IndexedDBKeyValueStore.mjs";

let idb = new IndexedDBKeyValueStore('walletData', 'data');

class LocalStorage {

    constructor() {
        // Constructor is not used in this static class
    }

    /**
     * Sets an item in local storage or IndexedDB.
     * @param {string} key - The key under which the value is stored.
     * @param {string} value - The value to be stored.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     */
    static async setItem(key, value) {
        if (typeof localStorage !== 'undefined') {
            // Use localStorage if available
            localStorage.setItem(key, value);
            return;
        }

        // Fallback to IndexedDB
        await idb.set(key, value);
    }

    /**
     * Removes an item from local storage or IndexedDB.
     * @param {string} key - The key of the item to be removed.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     */
    static async removeItem(key) {
        if (typeof localStorage !== 'undefined') {
            // Use localStorage if available
            localStorage.removeItem(key);
            return;
        }

        // Fallback to IndexedDB
        await idb.delete(key);
    }

    /**
     * Retrieves an item from local storage or IndexedDB.
     * @param {string} key - The key of the item to retrieve.
     * @returns {Promise<string | null>} - A promise that resolves with the retrieved value, or null if not found.
     */
    static async getItem(key) {
        if (typeof localStorage !== 'undefined') {
            // Use localStorage if available
            return localStorage.getItem(key);
        }

        // Fallback to IndexedDB
        return await idb.get(key);
    }
}

export default LocalStorage;
