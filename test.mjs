import EmbeddedWallet from "./index.mjs";

let wallet = new EmbeddedWallet('https://cloudflare-eth.com');
await wallet.init();
window.wallet = wallet;

console.log(await wallet.eth_chainId());
