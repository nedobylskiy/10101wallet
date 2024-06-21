import {Web3} from "web3";
import Keystorage from "./modules/Keystorage.mjs";
import {createConnector} from "@wagmi/core";
import EventEmitter from 'events';

class EmbeddedWallet extends EventEmitter {
    currentAccount = null;

    constructor(urlOrProvider) {
        super();
        this.web3 = new Web3(urlOrProvider);
    }

    async generateNewAccount(password = '', accountName = 'mainAccount') {
        if (!password || password.trim().length === 0) {
            throw new Error('Password is required');
        }

        //Generate new account
        let account = this.web3.eth.accounts.create();
        let privateKey = account.privateKey;

        //Save it to encrypted local storage
        let encryptedKey = await Keystorage.save(privateKey, password, accountName);

        //Load it to web3 wallet
        await this.#loadWeb3AccountByPrivateKey(privateKey);

        //delete account.privateKey; //TODO в будущем надо будет удалять приватный ключ из объекта

        return {...account, encryptedKey, privateKey};
    }

    async loadAccount(password, accountName = 'mainAccount') {
        let privateKey = await Keystorage.load(password, accountName);
        await this.#loadWeb3AccountByPrivateKey(privateKey);
    }

    async getEncryptedAccount(accountName = 'mainAccount') {
        return await Keystorage.getEncryptedAccount(accountName);
    }

    async setEcryptedAccount(encryptedKey, password, accountName = 'mainAccount') {
        await Keystorage.setEcryptedAccount(encryptedKey, password, accountName);
    }

    async #loadWeb3AccountByPrivateKey(privateKey) {
        await this.#unloadWeb3Account(); //Unload active account to prevent key leak
        const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
        await this.web3.eth.accounts.wallet.add(account);
        this.currentAccount = account;
    }

    async loadAccountByPrivateKey(privateKey, password = '', accountName = 'mainAccount') {
        await this.#loadWeb3AccountByPrivateKey(privateKey);
        await Keystorage.save(privateKey, password, accountName);
    }

    async #unloadWeb3Account() {
        try {
            this.web3.eth.accounts.wallet.remove(this.currentAccount);
        }catch (e) {
        }
        this.currentAccount = null;
    }



    async getAddress(){
        return this.currentAccount.address;
    }

    async isAuthorized() {
        return this.currentAccount !== null;
    }

    async hasSavedAccount() {
        return (await Keystorage.getEncryptedAccount()) !== null;
    }

    async getBalance(address) {
        return await this.web3.eth.getBalance(address);
    }

    async getGasPrice() {
        const gasPrice = await this.web3.eth.getGasPrice();
        return this.web3.utils.toWei((parseFloat(this.web3.utils.fromWei(gasPrice, 'gwei')) * 1.5).toString(), 'gwei');
    }

    /**
     * Simulate RPC provider
     * @param method
     * @param params
     * @returns {Promise<*>}
     */
    async request(rpc){
        console.log('request', arguments);
        if(!rpc.params){
            rpc.params = [];
        }
        return await this[rpc.method](...rpc.params);
    }


    //Provider methods
    async personal_sign(message, address){
        this.emit('personal_sign_request', { message, address });

        try {
            await new Promise((resolve, reject) => {
                this.once('personal_sign_approved', resolve);
                this.once('personal_sign_rejected', () => {
                    reject(new Error('User rejected the sign request.'));
                });
            });

            return (await this.currentAccount.sign(message)).signature;
        } catch (error) {
            console.error('Error during personal sign:', error);
            throw error;
        }
    }

    async eth_chainId(){
        return await this.web3.eth.getChainId();
    }

    async eth_sendTransaction({data, from, to}){
        this.emit('eth_sendTransaction_request', { data, from, to });

        try {
            const tx = await new Promise((resolve, reject) => {
                this.once('eth_sendTransaction_approved', resolve);
                this.once('eth_sendTransaction_rejected', () => {
                    reject(new Error('User rejected the transaction request.'));
                });
            });

            let signedTx = await this.currentAccount.signTransaction({ ...tx, gasPrice: await this.getGasPrice() });
            this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

            return signedTx.transactionHash;
        } catch (error) {
            console.error('Error during transaction send:', error);
            throw error;
        }
    }
}

export default EmbeddedWallet;


export function embedded10101WalletConnector({network,
    chains,
    options
                                             }){
    console.log('embedded10101WalletConnector', network, chains, options);
    console.log(network.rpcUrls.default.http);
    let wallet = new EmbeddedWallet(network.rpcUrls.default.http[0]);

    let id = 'embedded10101';
    let name = 'Embedded 10101';
    let type = 'wallet';


    return createConnector((config) => ({
        id,
        name,
        type,
        getProvider: async function () {
            return wallet;
        },
        connect: async function () {
            console.log('connect');


      try {
        if (await wallet.hasSavedAccount()) {
        wallet.emit('password_request');

        const password = await new Promise((resolve, reject) => {
          wallet.once('password_provided', resolve);
          wallet.once('password_rejected', () => {
            reject(new Error('User rejected the password request.'));
          });
        });

          try {
            await wallet.loadAccount(password);
          } catch (e) {
            console.error('Invalid password', e);
            throw e;
          }
        } else {
          wallet.emit('account_action_request');

          const { action, privateKey, password } = await new Promise((resolve, reject) => {
            wallet.once('account_action_provided', resolve);
            wallet.once('account_action_rejected', () => {
              reject(new Error('User rejected the account action request.'));
            });
          });

          if (action === 'generate') {
            const generatedAccount = await wallet.generateNewAccount(password);
            wallet.emit('private_key_provided', generatedAccount.privateKey);
          } else if (action === 'import') {
            await wallet.loadAccountByPrivateKey(privateKey, password);
          } else {
            throw new Error("Invalid action. Please provide 'generate' or 'import'.");
          }
        }

        return {
          accounts: [await wallet.getAddress()],
          chainId: await wallet.eth_chainId()
        };

      } catch (e) {
        console.error('Error during connect', e);
        throw e;
      }
        },
        getAccounts: async function () {
            return [await wallet.getAddress()];
        },
        onConnect: async function () {
        },
        disconnect: async function () {
        },
        isAuthorized: async function () {
            return await wallet.isAuthorized();
        },
        onDisconnect: async function () {},
        getChainId: async function () {
            return await wallet.eth_chainId();
        },
        onAccountsChanged: async function () {},
        onMessage: async function () {
            console.log('onMessage', arguments);
        },
        switchChain: async function () {

        }

    }))
}
