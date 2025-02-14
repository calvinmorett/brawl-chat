import BaseObservableList from "./BaseObservableList.js";
import sortedIndex from "../../utils/sortedIndex.js";

export default class SortedArray extends BaseObservableList {
    constructor(comparator) {
        super();
        this._comparator = comparator;
        this._items = [];
    }

    setManySorted(items) {
        // TODO: we can make this way faster by only looking up the first and last key,
        // and merging whatever is inbetween with items
        // if items is not sorted, 💩🌀 will follow!
        // should we check?
        // Also, once bulk events are supported in collections,
        // we can do a bulk add event here probably if there are no updates
        // BAD CODE!
        for(let item of items) {
            this.set(item);
        }
    }

    set(item, updateParams = null) {
        const idx = sortedIndex(this._items, item, this._comparator);
        if (idx >= this._items.length || this._comparator(this._items[idx], item) !== 0) {
            this._items.splice(idx, 0, item);
            this.emitAdd(idx, item)
        } else {
            this._items[idx] = item;
            this.emitUpdate(idx, item, updateParams);
        }
    }

    remove(item) {
        throw new Error("unimplemented");
    }

    get array() {
        return this._items;
    }

    get length() {
        return this._items.length;
    }

    [Symbol.iterator]() {
        return this._items.values();
    }
}
