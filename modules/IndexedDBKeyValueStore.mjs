export default class IndexedDBKeyValueStore {
    constructor(dbName, storeName) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
        this.isOpened = false;
    }

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
                reject('IndexedDB open error:', event.target.error);
            };
        });
    }

    async set(key, value) {
        if (!this.isOpened) {
            await this.open();
        }
        return await new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(value, key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = event => {
                reject('IndexedDB write error:', event.target.error);
            };
        });
    }

    async get(key) {
        if (!this.isOpened) {
            await this.open();
        }
        return await new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = event => {
                reject('IndexedDB read error:', event.target.error);
            };
        });
    }

    async delete(key) {
        if (!this.isOpened) {
            await this.open();
        }
        return await new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = event => {
                reject('IndexedDB delete error:', event.target.error);
            };
        });
    }
}
