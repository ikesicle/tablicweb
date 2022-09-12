import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import GameRenderer from '../gamerenderer.js';
import { text } from 'util/locales.js';

import CheatSheet from '../cheatsheet.js';
import DebugChat from './debugchat.js';

function DebugGame(props) {
  const [getDialog, setDialog] = useState(null);
  const debugGame = {
    deck: [],
    lastPlay: "game start",
    p1hand: ["1A","22","33","44","15"],
    p2hand: [],
    p3hand: [],
    p4hand: [],
    playercount: 4,
    playernames: ["Player 1", "Player 2", "Player 3", "Player 4"],
    players: ["1","2","3","4"],
    points: [0, 0, 0, 0],
    capturecount: [0, 0, 0, 0],
    roomname: "Debug CSS Room",
    started: "play",
    talon: ["36","27","18","49","1K"],
    talonprev: [],
    turn: 0,
    gamemode: "FFA",
    teamdist: [0,0,0,0],
    turnorder: [0, 1, 2, 3]
  };

  return (<>
    <button className="exitbutton" style={{right: "auto", left: "2vw", top:"3em"}} onClick={props.exit}>{text.Inputs.Exit}</button>
    <GameRenderer gameState={debugGame} spectating={false} onPlay={()=>{}} playerID={0} time={"Time"} getDialog={getDialog} setDialog={setDialog}/>
    <CheatSheet />
    <DebugChat isSpectator={false} context={"ingame"}/>
  </>)
}

export default DebugGame;