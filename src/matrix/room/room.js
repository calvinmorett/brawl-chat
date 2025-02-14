import EventEmitter from "../../EventEmitter.js";
import RoomSummary from "./summary.js";
import SyncWriter from "./timeline/persistence/SyncWriter.js";
import Timeline from "./timeline/Timeline.js";
import FragmentIdComparer from "./timeline/FragmentIdComparer.js";

export default class Room extends EventEmitter {
	constructor({roomId, storage, hsApi, emitCollectionChange}) {
        super();
        this._roomId = roomId;
        this._storage = storage;
        this._hsApi = hsApi;
		this._summary = new RoomSummary(roomId);
        this._fragmentIdComparer = new FragmentIdComparer([]);
		this._syncWriter = new SyncWriter({roomId, storage, fragmentIdComparer: this._fragmentIdComparer});
        this._emitCollectionChange = emitCollectionChange;
        this._timeline = null;
	}

    async persistSync(roomResponse, membership, txn) {
		const summaryChanged = this._summary.applySync(roomResponse, membership, txn);
		const newTimelineEntries = await this._syncWriter.writeSync(roomResponse, txn);
        return {summaryChanged, newTimelineEntries};
    }

    emitSync({summaryChanged, newTimelineEntries}) {
        if (summaryChanged) {
            this.emit("change");
            this._emitCollectionChange(this);
        }
        if (this._timeline) {
            this._timeline.appendLiveEntries(newTimelineEntries);
        }
	}

	load(summary, txn) {
		this._summary.load(summary);
		return this._syncWriter.load(txn);
	}

    get name() {
        return this._summary.name;
    }

    get id() {
        return this._roomId;
    }

    async openTimeline() {
        if (this._timeline) {
            throw new Error("not dealing with load race here for now");
        }
        this._timeline = new Timeline({
            roomId: this.id,
            storage: this._storage,
            hsApi: this._hsApi,
            fragmentIdComparer: this._fragmentIdComparer,
            closeCallback: () => this._timeline = null,
        });
        await this._timeline.load();
        return this._timeline;
    }
}

