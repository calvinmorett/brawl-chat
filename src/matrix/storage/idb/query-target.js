import {iterateCursor, reqAsPromise} from "./utils.js";

export default class QueryTarget {
    constructor(target) {
        this._target = target;
    }

    _openCursor(range, direction) {
        if (range && direction) {
            return this._target.openCursor(range, direction);
        } else if (range) {
            return this._target.openCursor(range);
        } else if (direction) {
            return this._target.openCursor(null, direction);
        } else {
            return this._target.openCursor();
        }
    }

    get(key) {
        return reqAsPromise(this._target.get(key));
    }

    reduce(range, reducer, initialValue) {
        return this._reduce(range, reducer, initialValue, "next");
    }

    reduceReverse(range, reducer, initialValue) {
        return this._reduce(range, reducer, initialValue, "prev");
    }
    
    selectLimit(range, amount) {
        return this._selectLimit(range, amount, "next");
    }

    selectLimitReverse(range, amount) {
        return this._selectLimit(range, amount, "prev");
    }

    selectWhile(range, predicate) {
        return this._selectWhile(range, predicate, "next");
    }

    selectWhileReverse(range, predicate) {
        return this._selectWhile(range, predicate, "prev");
    }

    async selectAll(range, direction) {
        const cursor = this._openCursor(range, direction);
        const results = [];
        await iterateCursor(cursor, (value) => {
            results.push(value);
            return {done: false};
        });
        return results;
    }

    selectFirst(range) {
        return this._find(range, () => true, "next");
    }

    selectLast(range) {
        return this._find(range, () => true, "prev");
    }

    find(range, predicate) {
        return this._find(range, predicate, "next");
    }

    findReverse(range, predicate) {
        return this._find(range, predicate, "prev");
    }

    /**
     * Checks if a given set of keys exist.
     * Calls `callback(key, found)` for each key in `keys`, in key sorting order (or reversed if backwards=true).
     * If the callback returns true, the search is halted and callback won't be called again.
     * `callback` is called with the same instances of the key as given in `keys`, so direct comparison can be used.
     */
    async findExistingKeys(keys, backwards, callback) {
        const direction = backwards ? "prev" : "next";
        const compareKeys = (a, b) => backwards ? -indexedDB.cmp(a, b) : indexedDB.cmp(a, b);
        const sortedKeys = keys.slice().sort(compareKeys);
        const firstKey = backwards ? sortedKeys[sortedKeys.length - 1] : sortedKeys[0];
        const lastKey = backwards ? sortedKeys[0] : sortedKeys[sortedKeys.length - 1];
        const cursor = this._target.openKeyCursor(IDBKeyRange.bound(firstKey, lastKey), direction);
        let i = 0;
        let consumerDone = false;
        await iterateCursor(cursor, (value, key) => {
            // while key is larger than next key, advance and report false
            while(i < sortedKeys.length && compareKeys(sortedKeys[i], key) < 0 && !consumerDone) {
                consumerDone = callback(sortedKeys[i], false);
                ++i;
            }
            if (i < sortedKeys.length && compareKeys(sortedKeys[i], key) === 0 && !consumerDone) {
                consumerDone = callback(sortedKeys[i], true);
                ++i;
            }
            const done = consumerDone || i >= sortedKeys.length;
            const jumpTo = !done && sortedKeys[i];
            return {done, jumpTo};
        });
        // report null for keys we didn't to at the end
        while (!consumerDone && i < sortedKeys.length) {
            consumerDone = callback(sortedKeys[i], false);
            ++i;
        }
    }

    _reduce(range, reducer, initialValue, direction) {
        let reducedValue = initialValue;
        const cursor = this._openCursor(range, direction);
        return iterateCursor(cursor, (value) => {
            reducedValue = reducer(reducedValue, value);
            return {done: false};
        });
    }

    _selectLimit(range, amount, direction) {
        return this._selectWhile(range, (results) => {
            return results.length === amount;
        }, direction);
    }

    async _selectWhile(range, predicate, direction) {
        const cursor = this._openCursor(range, direction);
        const results = [];
        await iterateCursor(cursor, (value) => {
            results.push(value);
            return {done: predicate(results)};
        });
        return results;
    }

    async _find(range, predicate, direction) {
        const cursor = this._openCursor(range, direction);
        let result;
        const found = await iterateCursor(cursor, (value) => {
            const found = predicate(value);
            if (found) {
                result = value;
            }
            return {done: found};
        });
        if (found) {
            return result;
        }
    }
}
