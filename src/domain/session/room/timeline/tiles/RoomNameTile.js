import SimpleTile from "./SimpleTile.js";

export default class RoomNameTile extends SimpleTile {
    
    get shape() {
        return "announcement";
    }

    get announcement() {
        const event = this._entry.event;
        const content = event.content;
        return `${event.sender} named the room "${content.name}"`
    }
}
