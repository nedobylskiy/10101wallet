export default class FrontendWindows {
    /**
     * Requests a password from the user.
     * This method listens for the 'password_provided' or 'password_rejected' events
     * emitted by the wallet instance.
     *
     * @param {Object} wallet - The wallet instance that emits the password request events.
     * @returns {Promise<string>} - A promise that resolves with the provided password or rejects if the request is canceled.
     */
    static async requestPassword(wallet) {
        // Emit the 'password_request' event to signal that the password request is being made
        wallet.emit('password_request');

        // Return a promise that resolves when the 'password_provided' event is emitted or rejects if 'password_rejected' is emitted
        return new Promise((resolve, reject) => {
            wallet.once('password_provided', resolve);
            wallet.once('password_rejected', () => {
                reject(new Error('User rejected the password request.'));
            });
        });
    }
}
