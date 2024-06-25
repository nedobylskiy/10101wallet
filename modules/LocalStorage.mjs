import IndexedDBKeyValueStore from "./IndexedDBKeyValueStore.mjs";

let data = {};

let idb = new IndexedDBKeyValueStore('walletData', 'data');

class LocalStorage {

    constructor() {

    }

    static async setItem(key, value) {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value);
            return;
        }

        await idb.set(key, value);

        // data[key] = value;
    }

    static async getItem(key) {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem(key);
        }

        return await idb.get(key);

        //  return data[key];
    }
}

export default LocalStorage;
