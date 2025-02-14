import { SortedArray } from "../../../observable/index.js";
import Direction from "./Direction.js";
import GapWriter from "./persistence/GapWriter.js";
import TimelineReader from "./persistence/TimelineReader.js";

export default class Timeline {
    constructor({roomId, storage, closeCallback, fragmentIdComparer, hsApi}) {
        this._roomId = roomId;
        this._storage = storage;
        this._closeCallback = closeCallback;
        this._fragmentIdComparer = fragmentIdComparer;
        this._hsApi = hsApi;
        this._entriesList = new SortedArray((a, b) => a.compare(b));
        this._timelineReader = new TimelineReader({
            roomId: this._roomId,
            storage: this._storage,
            fragmentIdComparer: this._fragmentIdComparer
        });
    }

    /** @package */
    async load() {
        const entries = await this._timelineReader.readFromEnd(50);
        this._entriesList.setManySorted(entries);
    }

    /** @package */
    appendLiveEntries(newEntries) {
        this._entriesList.setManySorted(newEntries);
    }

    /** @public */
    async fillGap(fragmentEntry, amount) {
        const response = await this._hsApi.messages(this._roomId, {
            from: fragmentEntry.token,
            dir: fragmentEntry.direction.asApiString(),
            limit: amount
        }).response();
        const gapWriter = new GapWriter({
            roomId: this._roomId,
            storage: this._storage,
            fragmentIdComparer: this._fragmentIdComparer
        });
        const newEntries = await gapWriter.writeFragmentFill(fragmentEntry, response);
        this._entriesList.setManySorted(newEntries);
    }

    // tries to prepend `amount` entries to the `entries` list.
    async loadAtTop(amount) {
        const firstEventEntry = this._entriesList.array.find(e => !!e.event);
        if (!firstEventEntry) {
            return;
        }
        const entries = await this._timelineReader.readFrom(
            firstEventEntry.asEventKey(),
            Direction.Backward,
            amount
        );
        this._entriesList.setManySorted(entries);
    }

    /** @public */
    get entries() {
        return this._entriesList;
    }

    /** @public */
    close() {
        this._closeCallback();
    }
}
