import BaseObservableList from "../../../../observable/list/BaseObservableList.js";
import sortedIndex from "../../../../utils/sortedIndex.js";

// maps 1..n entries to 0..1 tile. Entries are what is stored in the timeline, either an event or gap
export default class TilesCollection extends BaseObservableList {
    constructor(entries, tileCreator) {
        super();
        this._entries = entries;
        this._tiles = null;
        this._entrySubscription = null;
        this._tileCreator = tileCreator;
    }

    onSubscribeFirst() {
        this._entrySubscription = this._entries.subscribe(this);
        this._populateTiles();
    }

    _populateTiles() {
        this._tiles = [];
        let currentTile = null;
        for (let entry of this._entries) {
            if (!currentTile || !currentTile.tryIncludeEntry(entry)) {
                currentTile = this._tileCreator(entry);
                this._tiles.push(currentTile);
            }
        }
        let prevTile = null;
        for (let tile of this._tiles) {
            if (prevTile) {
                prevTile.updateNextSibling(tile);
            }
            tile.updatePreviousSibling(prevTile);
            prevTile = tile;
        }
        if (prevTile) {
            prevTile.updateNextSibling(null);
        }
    }

    _findTileIdx(sortKey) {
        return sortedIndex(this._tiles, sortKey, (key, tile) => {
            // negate result because we're switching the order of the params
            return -tile.compareSortKey(key);
        });
    }

    _findTileAtIdx(sortKey, idx) {
        const tile = this._getTileAtIdx(idx);
        if (tile && tile.compareSortKey(sortKey) === 0) {
            return tile;
        }
    }

    _getTileAtIdx(tileIdx) {
        if (tileIdx >= 0 && tileIdx < this._tiles.length) {
            return this._tiles[tileIdx];
        }
        return null;
    }

    onUnsubscribeLast() {
        this._entrySubscription = this._entrySubscription();
        this._tiles = null;
    }

    onReset() {
        // if TileViewModel were disposable, dispose here, or is that for views to do? views I suppose ...
        this._buildInitialTiles();
        this.emitReset();
    }

    onAdd(index, entry) {
        const {sortKey} = entry;
        const tileIdx = this._findTileIdx(sortKey);
        const prevTile = this._getTileAtIdx(tileIdx - 1);
        if (prevTile && prevTile.tryIncludeEntry(entry)) {
            this.emitUpdate(tileIdx - 1, prevTile);
            return;
        }
        // not + 1 because this entry hasn't been added yet
        const nextTile = this._getTileAtIdx(tileIdx);
        if (nextTile && nextTile.tryIncludeEntry(entry)) {
            this.emitUpdate(tileIdx, nextTile);
            return;
        }

        const newTile = this._tileCreator(entry);
        if (newTile) {
            prevTile.updateNextSibling(newTile);
            nextTile.updatePreviousSibling(newTile);
            this._tiles.splice(tileIdx, 0, newTile);
            this.emitAdd(tileIdx, newTile);
        }
        // find position by sort key
        // ask siblings to be included? both? yes, twice: a (insert c here) b, ask a(c), if yes ask b(a), else ask b(c)? if yes then b(a)?
    }

    onUpdate(index, entry, params) {
        const {sortKey} = entry;
        const tileIdx = this._findTileIdx(sortKey);
        const tile = this._findTileAtIdx(sortKey, tileIdx);
        if (tile) {
            const newParams = tile.updateEntry(entry, params);
            if (newParams) {
                this.emitUpdate(tileIdx, tile, newParams);
            }
        }
        // technically we should handle adding a tile here as well
        // in case before we didn't have a tile for it but now we do
        // but in reality we don't have this use case as the type and msgtype
        // doesn't change. Decryption maybe is the exception?


        // outcomes here can be
        //   tiles should be removed (got redacted and we don't want it in the timeline)
        //   tile should be added where there was none before ... ?
        //   entry should get it's own tile now
        //   merge with neighbours? ... hard to imagine use case for this  ...
    }

    // would also be called when unloading a part of the timeline
    onRemove(index, entry) {
        const {sortKey} = entry;
        const tileIdx = this._findTileIdx(sortKey);
        const tile = this._findTileAtIdx(sortKey, tileIdx);
        if (tile) {
            const removeTile = tile.removeEntry(entry);
            if (removeTile) {
                const prevTile = this._getTileAtIdx(tileIdx - 1);
                const nextTile = this._getTileAtIdx(tileIdx + 1);
                this._tiles.splice(tileIdx, 1);
                prevTile && prevTile.updateNextSibling(nextTile);
                nextTile && nextTile.updatePreviousSibling(prevTile);
                this.emitRemove(tileIdx, tile);
            } else {
                this.emitUpdate(tileIdx, tile);
            }
        }
    }

    onMove(fromIdx, toIdx, value) {
        // this ... cannot happen in the timeline?
        // should be sorted by sortKey and sortKey is immutable
    }

    [Symbol.iterator]() {
        return this._tiles.values();
    }
}