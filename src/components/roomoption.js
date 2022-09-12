import React, {useState} from 'react';
import { auth } from 'cfg.js';
import { text, fmt } from 'util/locales.js';

function RoomOption(props) {
  const data = props.rm.data()
  const isProtected = data["password"] === "";
  const nojoin = data["playercount"] === 4;
  if (!auth.currentUser) {
    return (<React.Fragment>
      {fmt(text.MiscText.ErrorComponent, {component: "RoomOption"})}
    </React.Fragment>)
  }
  return (
    <div className={"roombutton" + (nojoin ? " nojoin" : "")} onClick={props.join}>
      <div className={"roominfo" + (nojoin ? " nojoin" : "")}>
        <div style={{fontSize: "2em", fontWeight: "bold"}}>{data["roomname"]}</div>
        <div style={{fontSize: "1.5em"}}>{data["roomcreator"]}</div>
        <div style={{fontSize: "1em", fontStyle: "italic", color: "lightgray"}}>{fmt(text.UIText.RoomID, {roomid: props.rm.id})}</div>
      </div>
      <div className="roomstats">
        <div style={{flexGrow: "1"}}><b>{data["playercount"]}</b>/4 {text.UIText.PlayersHeader}</div>
        <div style={{flexGrow: "1"}}>{isProtected ? text.UIText.Public : text.UIText.Protected}</div>
        <div style={{flexGrow: "1"}}>{data["started"] ? text.UIText.InGame : text.UIText.InLobby}</div>
      </div>
    </div>
  );
}

export default RoomOption;