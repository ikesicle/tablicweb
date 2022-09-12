import React, {useState, useEffect} from 'react';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { server } from 'cfg.js';
import { useInterval } from 'util/chooks.js';
import { text, fmt } from 'util/locales.js';

import GameRenderer from './gamerenderer.js';
import CheatSheet from './cheatsheet.js';
import Chat from './chat.js';
import RoomStart from './roomlobby.js';

import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';

const gamehost = server + '/gamehost';
const opacityIn = { opacity: 1 };
const opacityOut = { opacity: 0 };

function NetworkGame(props) {
  const firestore = props.firestore;
  const auth = props.auth;

  const game = firestore.collection('rooms').doc(props.gameID);
  const [ dialogMessage, setDialog ] = useState(null);
  const [ gameState, loading, error ] = useDocumentData(game);
  const [ time, setTime ] = useState(0);
  const [ timerSpeed, setSpeed ] = useState(null);
  const [ spectatorView ] = useState(0);
  const [ sending, setSendState ] = useState(false); 

  var playerIndex, yourHand, spectator = false;
  if (gameState && !loading && !error && auth.currentUser) {
    playerIndex = gameState.players.indexOf(auth.currentUser.uid);
    if (playerIndex === -1) { playerIndex = spectatorView; spectator = true; }
    yourHand = gameState["p" + String(playerIndex + 1) + "hand"];
  }
  
  // Client-side verification can be done with the Game object; firing off the game requires a bit more work.
  const sendAction = async (actiontype, card, selectedTalon) => {
    if (sending) return;
    setSendState(true);
    await fetch(gamehost, {
      method: "POST",
      headers: {
        "userid": auth.currentUser.uid,
        "gameid": props.gameID,
        "Content-Type": "application/json",
        "Origin": window.location.href
      },
      body: JSON.stringify({
        datatype: "turn",
        type: actiontype,
        card: card,
        captures: selectedTalon
      })
    }).then(async (response)=> {
      if (response.status !== 200) setDialog(await response.text());
      else setDialog(null);
      setSendState(false);
    }).catch((err)=>{
      setDialog("An unexpected error occurred while sending.")
      setSendState(false);
    });
  };

  // Requesting the update requires hand data. Must be done completely in here.
  const requestUpdate = async () => {
    if (spectator) return;
    if (playerIndex === gameState.turnorder[gameState.turn]) {
      await fetch(gamehost, {
        method: "POST",
        headers: {
          "userid": auth.currentUser.uid,
          "gameid": props.gameID,
          "Content-Type": "application/json",
          "Origin": window.location.href
        },
        body: JSON.stringify({
          datatype: "turn",
          type: "play",
          card: yourHand[Math.floor(Math.random()*yourHand.length)],
          captures: []
        })
      }).then(async (response)=> {
        if (response.status !== 200) {
          setDialog(await response.text());
        }
        else setDialog(null);
      }).catch((err)=>{
        console.log("Problem with sending Data to home servers: " + String(err))
        setDialog("An unexpected error occurred while sending.")
      });
    } else {
      await fetch(gamehost, {
        method: "POST",
        headers: {
          "userid": auth.currentUser.uid,
          "gameid": props.gameID,
          "Content-Type": "application/json",
          "Origin": window.location.href
        },
        body: JSON.stringify({
          datatype: "update"
        })
      }).then(async (response)=> {
        if (response.status !== 200) {
          setDialog(await response.text());
        }
        else setDialog(null);
      }).catch((err)=>{
        console.log("Problem with sending Data to home servers: " + String(err))
        setDialog("An unexpected error occurred while sending.")
      });
    }
  };

  useEffect(()=> {
    if (gameState && gameState.started === "play") {
      setTime(30);
      setSpeed(100);
    }
    else {
      setTime("--")
      setSpeed(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState && gameState.turn, gameState && gameState.players]);

  useInterval(async ()=> { // Credit to Dan Abramov (https://overreacted.io/) for this
    if (time <= 0) {
      console.log("Sending card!")
      setSpeed(null)
      setTime(0)
      await requestUpdate();
    }
    else {
      let k = firebase.firestore.Timestamp.now().seconds;
      let j = gameState.date.seconds;
      setTime(30-(k-j));
    }
  }, timerSpeed);

  var content;

  if (!auth.currentUser) {
    content = (<React.Fragment>
      {fmt(text.MiscText.ErrorComponent, {component: "Game"})}
    </React.Fragment>)
  }

  if (gameState) {
    if (gameState.started) {
      content = (
        <motion.div key="ingame" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
          <GameRenderer gameState={gameState} spectating={spectator} onPlay={sendAction} playerID={playerIndex} time={time} getDialog={dialogMessage} setDialog={setDialog}/>
          <CheatSheet />
          <Chat auth={auth} gameStarted={true} isSpectator={spectator} game={game} context={"ingame"}/>
        </motion.div>
      )
    } else content = (
        <motion.div key="lobby" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
          <RoomStart gameID={props.gameID} setGame={props.setGame} isSpectator={spectator}/> 
        </motion.div>
      );
  } else if (!error) { content = (
      <motion.div key="loading" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
        <div style={{transform: "translateY(50vh)"}}>{text.UIText.Loading}</div>
        <button className="closedialog" style={{transform: "translateY(50vh)"}} onClick={()=>props.setGame(null)}>{text.UIText.MenuReturn}</button>
      </motion.div>
    )} else {
    content = (
      <motion.div key="error" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
        <div className="dialog">
          <div style={{transform: "translateY(50vh)"}}>{text.MiscText.ErrorLoading}</div>
          <button className="closedialog" style={{transform: "translateY(50vh)"}} onClick={()=>props.setGame(null)}>{text.UIText.MenuReturn}</button>
        </div>
      </motion.div>
    );
  }
  
  return (
    <AnimatePresence exitBeforeEnter>
      {content}
    </AnimatePresence>
  );
}

export default NetworkGame;