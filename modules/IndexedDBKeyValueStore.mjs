export default class IndexedDBKeyValueStore {
    /**
     * Creates an instance of IndexedDBKeyValueStore.
     * @param {string} dbName - The name of the IndexedDB database.
     * @param {string} storeName - The name of the object store within the database.
     */
    constructor(dbName, storeName) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
        this.isOpened = false;
    }

    /**
     * Opens the IndexedDB database and creates the object store if it doesn't exist.
     * @returns {Promise<void>} - A promise that resolves when the database is successfully opened.
     */
    open() {
        this.isOpened = true;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = event => {
                this.db = event.target.result;
                if (!this.db.objectStoreNames.contains(this.storeName)) {
                    this.db.createObjectStore(this.storeName);
                }
            };

            request.onsuccess = event => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = event => {
                reject(`IndexedDB open error: ${event.target.error}`);
            };
        });
    }

    /**
     * Adds or updates a value in the object store.
     * @param {string} key - The key under which the value will be stored.
     * @param {*} value - The value to be stored.
     * @returns {Promise<void>} - A promise that resolves when the value is successfully stored.
     */
    async set(key, value) {
        if (!this.isOpened) {
            await this.open();
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(value, key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = event => {
                reject(`IndexedDB write error: ${event.target.error}`);
            };
        });
    }

    /**
     * Retrieves a value from the object store.
     * @param {string} key - The key of the value to be retrieved.
     * @returns {Promise<*>} - A promise that resolves with the retrieved value or null if not found.
     */
    async get(key) {
        if (!this.isOpened) {
            await this.open();
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = event => {
                reject(`IndexedDB read error: ${event.target.error}`);
            };
        });
    }

    /**
     * Deletes a value from the object store.
     * @param {string} key - The key of the value to be deleted.
     * @returns {Promise<void>} - A promise that resolves when the value is successfully deleted.
     */
    async delete(key) {
        if (!this.isOpened) {
            await this.open();
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = event => {
                reject(`IndexedDB delete error: ${event.target.error}`);
            };
        });
    }
}
