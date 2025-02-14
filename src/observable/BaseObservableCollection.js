export default class BaseObservableCollection {
    constructor() {
        this._handlers = new Set();
    }

    onSubscribeFirst() {

    }

    onUnsubscribeLast() {

    }

    subscribe(handler) {
        this._handlers.add(handler);
        if (this._handlers.size === 1) {
            this.onSubscribeFirst();
        }
        return () => {
            if (handler) {
                this._handlers.delete(this._handler);
                if (this._handlers.size === 0) {
                    this.onUnsubscribeLast();
                }
                handler = null;
            }
            return null;
        };
    }

    // Add iterator over handlers here
}
