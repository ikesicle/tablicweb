import React, { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { text, fmt } from 'util/locales.js';
import { auth, firestore, gamehost, opacityIn, opacityOut } from 'cfg.js';
import { Deck, generateTurnOrder, ranNum } from 'util/tablic.js';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';

import GamehostStatus from './gamestatus.js';
import Dialog from './dialog.js';
import Chat from './chat.js';

const purify = DOMPurify.sanitize;

function RoomStart(props) {
  const [ user ] = useAuthState(auth);
  const game = firestore.collection('rooms').doc(props.gameID);
  const userstatus = !user ? null : firestore.collection('userstates').doc(user.uid);
  const [ dialogMessage, setDialog ] = useState(null);
  const [ gameState, loading, error ] = useDocumentData(game);
  const spectator = gameState && gameState.players.indexOf(user.uid) === -1;

  var playerIndex = spectator ? -1 : (gameState ? gameState.players.indexOf(user.uid) : -1);

  const startGame = async () => {
    if (gameState.started) return;
    if (gameState.playercount <= 1) {
      setDialog(text.Dialogs.RequirePlayers);
      return;
    }

    if (gameState.gamemode === "TEM") {
      var blues = 0;
      var reds = 0;
      gameState.teamdist.forEach((elem)=>{
        if (elem === 1) reds++;
        else blues++;
      });
      if ((!blues || !reds)) {
        setDialog(text.Dialogs.NoEmptyTeams);
        return;
      }
    }

    var connect = true;

    await fetch(gamehost, {
      method: "GET",
      headers: {
        "Origin": window.location.href,
        "Content-Type": "application/json"
      }
    }).then(obj=>{
      if (!obj.ok) {
        setDialog(text.Dialogs.GamehostOffline);
        connect = false;
      }
    }).catch(err=>{
      setDialog(fmt(text.MiscText.ErrorSendGamehost, {error: String(err)}));
      connect = false;
    });

    if (!connect) return;

    const deck = new Deck();
    deck.Shuffle();
    const talon = deck.DealCard(4);
    var hands = [];
    for (let i = 0; i < gameState.playercount; i++) hands.push(gameState.gamemode === "TEM" ? deck.DealCard(3) : deck.DealCard(6));

    var torder = [];
    if (gameState.gamemode === "FFA") torder = generateTurnOrder(gameState.playercount);
    else if (gameState.gamemode === "TEM") {
      var teams = [[],[]];
      for (let i = 0; i < 4; i++) {
        teams[gameState.teamdist[i]].push(i);
      }
      var seed = ranNum(1,10);
      var seed2 = ranNum(1,10);
      for (let i = 0; i < 4; i++) {
        torder.push(teams[(i+seed)%2][Math.floor((i+seed2)/2)%2]);
      }
    }
    var initializer = {
      deck: deck.deck.map(crd => crd.toString()),
      talon: talon.map(crd => crd.toString()),
      points: [0,0,0,0],
      capturecount: [0,0,0,0],
      started: "play",
      turn: 0,
      lastPlay: "game start",
      date: firestore.Timestamp.now(),
      turnorder: torder,
      lastcaptureplayer: null
    }

    var toMSG = "";
    torder.forEach((num) => {
      toMSG += gameState.playernames[num] + " -> ";
    });

    for (let i = 0; i < gameState.playercount; i++) initializer["p" + String(i+1) + "hand"] = hands[i].map(crd => crd.toString());

    await game.set(initializer, {
      merge: true
    });
    await game.collection('chat').add({
      message: text.SystemChatMessages.GameStartChatSep,
      senderID: "0",
      senderName: "[ System ]",
      timestamp: firestore.Timestamp.now(),
      spectate: false
    });
    game.collection('chat').add({
      message: fmt(text.SystemChatMessages.TurnOrder, {torderstring: toMSG}),
      senderID: "0",
      senderName: "[ System ]",
      timestamp: firestore.Timestamp.now(),
      spectate: false
    });
  };

  const removeAsPlayer = async (message) => {
    if (gameState.started) return;
    let players = gameState.players.slice();
    let playernames = gameState.playernames.slice();
    let playercount = gameState.playercount;
    players.splice(players.indexOf(user.uid),1);
    playernames.splice(playernames.indexOf(user.displayName),1);
    playercount--;

    if (gameState.gamemode === "TEM") {
      await game.collection('chat').add({
        message: fmt(text.SystemChatMessages.ToggleGamemode, {gamemode: "Free For All (FFA)"}),
        senderID: "0",
        senderName: "[ System ]",
        timestamp: firestore.Timestamp.now(),
        spectate: false
      });
    }
    await game.set({
      players: players,
      playernames: playernames,
      playercount: playercount,
      gamemode: "FFA",
      teamdist: [0,0,0,0]
    }, {
      merge: true
    });
    if (playercount === 0) {
      var collection = await (game.collection('chat').get());
      collection.forEach((snap) => snap.ref.delete());
      game.delete();
      props.setGame(null);
    }
    else {
      await game.collection('chat').add({
        message: message,
        senderID: "0",
        senderName: "[ System ]",
        timestamp: firestore.Timestamp.now(),
        spectate: false
      });
    }
    await userstatus.set({
      inGame: ""
    }, {merge: true})
  };

  const switchGame = async () => {
    if (gameState.started) return;
    if (spectator) {
      if (user && gameState) {
        if (gameState.playercount < 4 && gameState.players.indexOf(user.uid) === -1) {
          await game.set({
            players: gameState.players.concat([user.uid]),
            playernames: gameState.playernames.concat([user.displayName]),
            playercount: gameState.playercount + 1
          }, {
            merge: true
          });
          await game.collection('chat').add({
            message: fmt(text.SystemChatMessages.UserPlayer, {user: user.displayName}),
            senderID: "0",
            senderName: "[ System ]",
            timestamp: firestore.Timestamp.now(),
            spectate: false
          });
        }
      }
      else setDialog(text.MiscText.ErrorGeneric)
    } else await removeAsPlayer(fmt(text.SystemChatMessages.UserSpectate, {user: user.displayName}));
  };

  const leaveGame = async () => {
    if (props.isSpectator) {
      await game.collection('chat').add({
        message: fmt(text.SystemChatMessages.LeaveSpectate, {user: user.displayName}),
        senderID: "0",
        senderName: "[ System ]",
        timestamp: firestore.Timestamp.now(),
        spectate: false
      });
      props.setGame(null);
      return;
    }
    await removeAsPlayer(fmt(text.SystemChatMessages.LeaveRoom, {user: user.displayName})).then(()=>{props.setGame(null)});
  };

  const toggleGamemode = async () => {
    var settings = {}
    if (gameState.gamemode === "FFA" && gameState.playercount === 4) {
      settings.gamemode = "TEM";
      settings.teamdist = [1,1,0,0];
      await game.collection('chat').add({
        message: fmt(text.SystemChatMessages.ToggleGamemode, {gamemode: "Teams (TEM)"}),
        senderID: "0",
        senderName: "[ System ]",
        timestamp: firestore.Timestamp.now(),
        spectate: false
      });
    } else {
      settings.gamemode = "FFA";
      settings.teamdist = [0,0,0,0];
      await game.collection('chat').add({
        message: fmt(text.SystemChatMessages.ToggleGamemode, {gamemode: "Free For All (FFA)"}),
        senderID: "0",
        senderName: "[ System ]",
        timestamp: firestore.Timestamp.now(),
        spectate: false
      });
    }
    await game.set(settings, {merge: true});
  }

  const switchTeams = async () => {
    if (gameState.gamemode !== "TEM" || playerIndex === -1) return;
    var newlist = gameState.teamdist.slice();
    newlist[playerIndex] = 1 - newlist[playerIndex];
    await game.set({
      teamdist: newlist
    }, {merge: true});
  }

  var content;

  if (gameState && !loading && !error) {
    var players = [];
    for (let i = 0; i < gameState.playercount; i++) {
      players.push(
        <React.Fragment key={gameState.players[i]}>
          <div key={gameState.playernames[i]} className="rbwrapper" style={{
            backgroundColor: (gameState.gamemode === "FFA" ? "white" : (gameState.teamdist[i] ? "rgb(255,200,200)" : "cyan")),
            fontWeight: (i === playerIndex ? "bold" : "normal")
          }}>
            {gameState.playernames[i]} - 
            <span style={{fontWeight: "normal"}}> {gameState.points[i]} {text.UIText.PointsAbbrv}</span>
          </div>
        </React.Fragment>
      )
    }
    content = (
      <motion.div key="lobby" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
        <Dialog gd={dialogMessage} sd={setDialog} />
        <Chat context="lobby" game={game} isSpectator={spectator} gameStarted={false}/>
        <GamehostStatus hidden={false} />
        <h1> { gameState.roomname } </h1>
        { gameState.winner && 
          <h2 dangerouslySetInnerHTML={{__html: purify(fmt(text.UIText.WinnerTitle, {winner: gameState.winner, winnerscore: String(gameState.winnerscore)}))}} />
        }
        
        <div style={{fontWeight: "bold", margin: "10px"}}>{text.UIText.PlayersHeader}</div>
        
        { players }

        { spectator ? null : <button onClick={startGame}>{text.Inputs.StartGame}</button> }
        <button onClick={switchGame}>{spectator ? text.Inputs.SpecToPlay : text.Inputs.PlayToSpec}</button>
        { spectator ? null : <React.Fragment>
          <button onClick={toggleGamemode} disabled={gameState.playercount !== 4}>{fmt(text.Inputs.Gamemode, {gamemode: gameState.gamemode})}</button>
          { gameState.gamemode === "TEM" && <button onClick={switchTeams}>{text.Inputs.SwitchTeams}</button> }
        </React.Fragment> }
        <button onClick={leaveGame}>{text.Inputs.LeaveGame}</button>
      </motion.div>
    );
  } else {
    content = (
      <motion.div key="blank" initial={opacityOut} animate={opacityIn} exit={opacityOut}/>
    );
  }
  return (
    <AnimatePresence exitBeforeEnter>
      {content}
    </AnimatePresence>
  );
}

export default RoomStart;