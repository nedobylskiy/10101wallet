
let data = {};

class LocalStorage{

    constructor() {

    }

    static setItem(key, value){
        if(typeof localStorage !== 'undefined'){
             localStorage.setItem(key, value);
             return;
        }
        data[key] = value;
    }

    static getItem(key){
        if(typeof localStorage !== 'undefined'){
            return localStorage.getItem(key);
        }
        return data[key];
    }
}

export default LocalStorage;
