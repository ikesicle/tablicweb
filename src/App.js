import twlogo from './logo.png';
import './App.css';
import { Deck, generateTurnOrder } from './tablic.js'
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useDocumentData, useCollection } from 'react-firebase-hooks/firestore';
import { firebaseConfig, server } from './cfg.js';
import useInterval from './chooks.js';
import { Dialog, GameRenderer } from './renderer.js';
import Tutorial from './tutorial.js';
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const firestore = firebase.firestore();
const gamehost = server + "/gamehost";

function GamehostStatus(props) {
  const [ status, setStatus ] = useState(false);

  const updateStatus = async () => {
    await fetch(gamehost, {
      method: "GET",
      headers: {
        "Origin": window.location.href,
        "Content-Type": "application/json"
      }
    }).then(async (obj) =>{
      if (!obj.ok) setStatus(false)
      else {
        setStatus(true);
      }
    }).catch(err=>{
      setStatus(false);
    });
  }
  useEffect(()=>{updateStatus()}, []);

  if (!props.hidden) return ( <React.Fragment>
    <div className="statusbox" style={{border: "2px solid", borderColor: status ? "green" : "red"}}>
      Status: <span style={{fontWeight: "bold"}}>{status ? "Online" : "Offline"}</span>
    </div>
  </React.Fragment>
  );
  return (
    <React.Fragment>
    </React.Fragment>
  );
}

function CheatSheet(props) {
  const [ tab, setTab ] = useState(0);
  const [ navOpen, setNav ] = useState(false);
  const [ open, setOpen ] = useState(false);
  let data;
  switch (tab) {
    case 0: // Basic rules + controls
      data = (<>
        <ul>
          <li>
            <b>Click</b> on cards to <b>select</b> them.
          </li>
          <li>
            <b>Play</b> a card by selecting from your hand (bottom row of cards) and clicking Play.
          </li>
          <li>
            <b>Capture</b> cards from the <b>talon</b> (middle of board) by selecting cards to capture from the talon and a card to capture from your hand.
          </li>
        </ul>
      </>);
      break;
    case 1: // Card Values
      data = (<>
        <table className="pointtable">
          <tbody>
          <tr>
            <th style={{width: "50%"}}>Card Number/Letter</th>
            <th style={{width: "50%"}}>Value</th>
          </tr>
          <tr>
            <td>Numbers</td>
            <td>As Written</td>
          </tr>
          <tr>
            <td>Aces (A)</td>
            <td><b>Variable</b>; can be 1 or 11</td>
          </tr>
          <tr>
            <td>Jacks (J)</td>
            <td>12</td>
          </tr>
          <tr>
            <td>Queens (Q)</td>
            <td>13</td>
          </tr>
          <tr>
            <td>Kings (K)</td>
            <td>14</td>
          </tr>
          </tbody>
        </table>
      </>);
      break;
    case 2: // Point Values
      data = (<>
        <table className="pointtable">
          <tbody>
          <tr>
            <th style={{width: "50%"}}>Card Type</th>
            <th style={{width: "50%"}}>Points yield</th>
          </tr>
          <tr>
            <td>2 ♣</td>
            <td>2</td>
          </tr>
          <tr>
            <td>10 ♦</td>
            <td>2</td>
          </tr>
          <tr>
            <td>Other Tens (10)</td>
            <td>1</td>
          </tr>
          <tr>
            <td>Jacks (J)</td>
            <td>1</td>
          </tr>
          <tr>
            <td>Queens (Q)</td>
            <td>1</td>
          </tr>
          <tr>
            <td>Kings (K)</td>
            <td>1</td>
          </tr>
          <tr>
            <td>Aces (A)</td>
            <td>1</td>
          </tr>
          </tbody>
        </table>
      </>);
      break;
    default:
      data = "Invalid Entry";
      break;
  }

  return (<>
    <div className="cheatsheet">
      <div className="csnavsup">
        <button className="csopen" onClick={()=>{setNav(!navOpen); setOpen(false);}}>Reference</button>
        <div className="csnavsub" style={ navOpen ? {} : {width: 0}}>
          <button onClick={()=>{setTab(0)}} onClick={()=>{setOpen(true);setTab(0);}}>Rules</button>
          <button onClick={()=>{setTab(1)}} onClick={()=>{setOpen(true);setTab(1);}}>Values</button>
          <button onClick={()=>{setTab(2)}} onClick={()=>{setOpen(true);setTab(2);}}>Points</button>
        </div>
      </div>
      <div className="cstabcontent" style={open ? {} : {height: 0, width: 0, opacity: 0}}>
        {data}
      </div>
    </div>
  </>)
}

function NetworkGame(props) {
  const game = firestore.collection('rooms').doc(props.gameID);
  const [ dialogMessage, setDialog ] = useState(null);
  const [ gameState, loading, error ] = useDocumentData(game);
  const [ time, setTime ] = useState(0);
  const [ timerSpeed, setSpeed ] = useState(null);
  const [ spectatorView ] = useState(0);

  var playerIndex, yourHand, spectator = false;
  if (gameState && !loading && !error && auth.currentUser) {
    playerIndex = gameState.players.indexOf(auth.currentUser.uid);
    if (playerIndex === -1) { playerIndex = spectatorView; spectator = true; }
    yourHand = gameState["p" + String(playerIndex + 1) + "hand"];
  }
  
  // Client-side verification can be done with the Game object; firing off the game requires a bit more work.
  const sendAction = (actiontype, card, selectedTalon) => {
    fetch(gamehost, {
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
    }).catch((err)=>{
      setDialog("An unexpected error occurred while sending.")
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
    if (gameState && gameState.started) {
      setTime("--");
      setSpeed(100);
    }
    else {
      setSpeed(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState && gameState.turn, gameState && gameState.players]);

  useInterval(async ()=> { // Credit to Dan Abramov (https://overreacted.io/) for this
    if (time <= 0) {
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

  if (!auth.currentUser) {
    return (<React.Fragment>
      An unexpected error occurred - GAME component.
    </React.Fragment>)
  }

  if (gameState) {
    if (gameState.started) {
      return (
        <React.Fragment>
          <GameRenderer gameState={gameState} spectating={spectator} onPlay={sendAction} playerID={playerIndex} time={time} getDialog={dialogMessage} setDialog={setDialog}/>
          <CheatSheet />
          <Chat gameStarted={true} isSpectator={spectator} game={game} context={"ingame"}/>
        </React.Fragment>

      )
    } else return <RoomStart gameID={props.gameID} setGame={props.setGame} isSpectator={spectator}/>
  } else if (!error) { return (
      <React.Fragment>
        <div style={{transform: "translateY(50vh)"}}>Loading...</div>
        <button className="closedialog" style={{transform: "translateY(50vh)"}} onClick={()=>props.setGame(null)}>Return to menu</button>
      </React.Fragment>
    )} else {
    return (
      <React.Fragment>
        <div className="dialog">
          <div style={{transform: "translateY(50vh)"}}>An unexpected error occurred while loading.</div>
          <button className="closedialog" style={{transform: "translateY(50vh)"}} onClick={()=>props.setGame(null)}>Return to menu</button>
        </div>
      </React.Fragment>
    );
  }
}

function Login(props) {
  const [formValue, setFormValue] = useState('');
  const [dialog, setDialog] = useState(null);
  const login = async (e) => {
    e.preventDefault();
    if (formValue.length > 15) {
      setDialog("Name must be 15 letters or less.");
      return;
    }
    auth.signInAnonymously();
    auth.onAuthStateChanged(user => {
      if (user) {
        user.updateProfile({
          displayName: formValue
        })
        props.setter(formValue)
      }
    })
  }
  
  return (
    <React.Fragment>
      <Dialog gd={dialog} sd={setDialog} />
      <GamehostStatus hidden={false} />
      <img src={twlogo} alt="Logo" className="applogo"></img>
      <form onSubmit={login}>
        <input value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder="Display Name" style={{
          height: "1.5em",
          margin: "1.5em",
          border: "1px solid black",
          padding: "3px"
        }} />
        <button type="submit" disabled={!formValue} style={{
          height: "2.1em",
          padding: "3px"
        }}>Login</button>
      </form>
      <div className="credits">Made with care by Ike and Adam</div>
    </React.Fragment>
  )
}

function Chat(props) {
  const gamechat = props.game.collection('chat');
  var filter = gamechat.orderBy("timestamp", "desc");
  filter = filter.limit(50);
  const [ gamechatref, loading, error ] = useCollection(filter);
  const [ messageValue, setMessage ] = useState("");
  const [ user ] = useAuthState(auth)
  const top = useRef(null);
  const [ chatState, setChatState ] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!messageValue) return;
    await gamechat.add({
      message: messageValue,
      senderID: user.uid,
      senderName: user.displayName,
      timestamp: firebase.firestore.Timestamp.now(),
      spectate: props.isSpectator
    })
    setChatState(true);
    if (gamechatref.docs.length > 50) { // Message limit
      await gamechat.doc(gamechatref.docs[0].id).delete()
    }
    setMessage("");
    top.current.scrollIntoView({behavior: "smooth"});
  }

  const toggleOpenClose = (e) => {
    setChatState(!chatState);
  }

  var ctr = -1;
  var chat;
  if (error) chat = "Unable to load chat.";
  else if (loading) chat = "Loading...";
  else {
    chat = gamechatref.docs.map(msgref => {
      ctr++;
      var msg = msgref.data();
      var senderstyle = {};

      if (msg.spectate) {
        // eslint-disable-next-line
        if (!props.isSpectator && props.gameStarted) return;
        senderstyle.color = "rgb(255,255,0)";
      } else if (msg.senderID === "0") {
        senderstyle.color = "white";
        senderstyle.fontWeight = "bold";
      } 
      else if (msg.senderID === (user && user.uid)) {
        senderstyle.color = "cyan";
      }
      else {
        senderstyle.color = "lime";
      }

      return (
        <React.Fragment key={msgref.id}>
          <div className={"message" + (ctr === 0 ? " new" : "")}>
             <span style={senderstyle}>{msg.senderName}: </span>
             {msg.message}
          </div>
        </React.Fragment>
      )
    });
  }

  return (
    <React.Fragment>
      <div className={"chatarea "+props.context} >
        <form className="chatform" onSubmit={send}>
          <input type="text" className="chatinput" value={messageValue} onChange={e => setMessage(e.target.value)} placeholder="Type..." />
          <input type="button" onClick={toggleOpenClose} value="Open/Close" />
        </form>

        <div className={"chatlogs "+props.context} style={chatState ? {} : {height: '0', opacity: '0'}}>
          <div ref={top}></div>
          {chat}
          <div className="message" style={{textAlign: "center"}}>-- End of records (30 most recent) --</div>
          <div style={{height: "3vh"}}>------</div>
        </div>
      </div>
    </React.Fragment>
  )
}

function RoomSelect(props) {
  const roomlist = firestore.collection('rooms');
  const [rooms, loadingRoom, roomError] = useCollection(roomlist);
  const [user] = useAuthState(auth);
  const [dialog, setDialog] = useState(null)
  const [inTutorial, setTutorial] = useState(false);
  
  const joinRoom = async (rm) => {
    console.log(`Logging in to room '${rm}'`)
    const game = roomlist.doc(rm);
    const go = await game.get();
    const gamedata = go.data();
    var msg = user.displayName + " is now spectating."
    if (user && gamedata) {
      if (gamedata["playercount"] < 4 && gamedata["players"].indexOf(user.uid) === -1 && !gamedata["started"]) {
        game.set({
          players: gamedata["players"].concat([user.uid]),
          playernames: gamedata["playernames"].concat([user.displayName]),
          playercount: gamedata["playercount"] + 1
        }, {
          merge: true
        });
        msg = user.displayName + " has joined."
        await game.collection('chat').add({
          message: msg,
          senderID: "0",
          senderName: "[ System ]",
          timestamp: firebase.firestore.Timestamp.now(),
          spectate: false
        });
      }
      else if (gamedata["players"].indexOf(user.uid !== -1)) {}
      else if (gamedata) {
        await game.collection('chat').add({
          message: msg,
          senderID: "0",
          senderName: "[ System ]",
          timestamp: firebase.firestore.Timestamp.now(),
          spectate: false
        });
      }
      props.setGame(rm);
    }
    else if (!(gamedata)) {
      setDialog("Unable to join.");
    }
  };

  const createGame = async () => {
    await roomlist.add({
      deck: [],
      lastPlay: "",
      p1hand: [],
      p2hand: [],
      p3hand: [],
      p4hand: [],
      playercount: 0,
      playernames: [],
      players: [],
      points: Array(4).fill(0),
      capturecount: Array(4).fill(0),
      roomname: user.displayName + "'s Room",
      started: false,
      talon: [],
      talonprev: [],
      turn: 0,
      winner: "",
      password: "",
      gamemode: "FFA",
      teamdist: [0,0,0,0],
      roomcreator: user.displayName,
      date: null,
      turnorder: []
    }).then(async (docRef) => {
      console.log("Creating chat logs")
      await docRef.collection('chat').add({
        message: "Room created at " + String(firebase.firestore.Timestamp.now().toDate()),
        senderID: "0",
        senderName: "[ System ]",
        timestamp: firebase.firestore.Timestamp.now(),
        spectate: false
      });
      await joinRoom(docRef.id);
    });
  };

  var rmav;

  if (roomError) {
    rmav = (<React.Fragment>
      An unexpected error occurred - ROOMSELECT component.
    </React.Fragment>)
  }
  else if (loadingRoom) {
    rmav = (
      <React.Fragment>
        <div>LOADING...</div>
      </React.Fragment>
    )
  }
  else {
    rmav = (rooms.docs.length > 1) ? rooms.docs.map(rm => rm.id === "userfield" ? null : (<RoomOption key={rm.id} join={async() => joinRoom(rm.id)} rm={rm} />)) : (<div style={{
      fontSize: "15px",
      fontStyle: "italic",
      margin: "10px"
    }}>There are currently no available rooms. Create one yourself, or check back later.</div>);
  }
  if (!inTutorial) {
    return (
      <React.Fragment>
        <GamehostStatus hidden={false} />
        <h1>
          Welcome, {user ? (user.displayName || props.username) : "Anonymous"}!
        </h1>
        <button onClick={async () => {
          props.setName(null);
          await auth.currentUser.delete();
        }}>Sign Out</button>
        <button onClick={createGame}>Create New Game</button>
        <button onClick={()=>{
          setTutorial(true);
        }}>How to play</button>
        <h2>Available Rooms...</h2>
        <Dialog gd={dialog} sd={setDialog} />
        {rmav}
      </React.Fragment>)
  } else {
    return (<Tutorial exit={()=>{
      setTutorial(false);
    }} user={user}/>)
  }
}

function RoomStart(props) {
  const game = firestore.collection('rooms').doc(props.gameID);
  const [ dialogMessage, setDialog ] = useState(null);
  const [ gameState, loading, error ] = useDocumentData(game);
  const [ user ] = useAuthState(auth);
  const spectator = gameState && gameState.players.indexOf(user.uid) === -1;

  var playerIndex = spectator ? -1 : (gameState ? gameState.players.indexOf(user.uid) : -1);

  const startGame = async () => {
    if (gameState.playercount <= 1) {
      setDialog("You must have at least 2 players!");
      return;
    }

    if (gameState.gamemode === "TEM") {
      var blues = 0;
      var reds = 0;
      gameState.teamdist.forEach((elem)=>{
        if (elem === 1) reds++;
        else blues++;
      });
      if (blues === 0 || reds === 0) {
        setDialog("Cannot have empty teams!");
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
        setDialog("Gamehost is currently offline.");
        connect = false;
      }
    }).catch(err=>{
      setDialog("An error occurred when sending the server check: "+String(err));
      connect = false;
    });

    if (!connect) return;

    const deck = new Deck();
    deck.Shuffle();
    const talon = deck.DealCard(4);
    var hands = [];
    for (let i = 0; i < gameState.playercount; i++) hands.push(gameState.gamemode === "TEM" ? deck.DealCard(3) : deck.DealCard(6));

    var initializer = {
      deck: deck.deck.map(crd => crd.toString()),
      talon: talon.map(crd => crd.toString()),
      points: [0,0,0,0],
      capturecount: [0,0,0,0],
      started: true,
      turn: 0,
      lastPlay: "game start",
      date: firebase.firestore.Timestamp.now(),
      turnorder: generateTurnOrder(gameState.playercount)
    }

    for (let i = 0; i < gameState.playercount; i++) initializer["p" + String(i+1) + "hand"] = hands[i].map(crd => crd.toString());

    game.set(initializer, {
      merge: true
    });
    await game.collection('chat').add({
      message: "Game started. Player and spectator chats are now separate.",
      senderID: "0",
      senderName: "[ System ]",
      timestamp: firebase.firestore.Timestamp.now(),
      spectate: false
    });
  };

  const removeAsPlayer = async (message) => {
    let players = gameState.players.slice();
    let playernames = gameState.playernames.slice();
    let playercount = gameState.playercount;
    players.splice(players.indexOf(user.uid),1);
    playernames.splice(playernames.indexOf(user.displayName),1);
    playercount--;

    if (gameState.gamemode === "TEM") {
      await game.collection('chat').add({
        message: "Gamemode is now set to Free For All (FFA).",
        senderID: "0",
        senderName: "[ System ]",
        timestamp: firebase.firestore.Timestamp.now(),
        spectate: false
      });
    }
    game.set({
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
        timestamp: firebase.firestore.Timestamp.now(),
        spectate: false
      });
    }
  };

  const switchGame = async () => {
    if (spectator) {
      if (user && gameState) {
        if (gameState.playercount < 4 && gameState.players.indexOf(user.uid) === -1) {
          game.set({
            players: gameState.players.concat([user.uid]),
            playernames: gameState.playernames.concat([user.displayName]),
            playercount: gameState.playercount + 1
          }, {
            merge: true
          });
          await game.collection('chat').add({
            message: user.displayName + " is now a player!",
            senderID: "0",
            senderName: "[ System ]",
            timestamp: firebase.firestore.Timestamp.now(),
            spectate: false
          });
        }
      }
      else setDialog("An unexpected error occurred.")
    } else await removeAsPlayer(user.displayName + " has joined the spectators' booth.");
  };

  const leaveGame = async () => {
    props.setGame(null)
    if (props.isSpectator) {
      await game.collection('chat').add({
        message: user.displayName + " has left the spectator's booth.",
        senderID: "0",
        senderName: "[ System ]",
        timestamp: firebase.firestore.Timestamp.now(),
        spectate: false
      });
      return;
    }
    await removeAsPlayer(user.displayName + " has left.");
  };

  const toggleGamemode = async () => {
    var settings = {}
    if (gameState.gamemode === "FFA" && gameState.playercount === 4) {
      settings.gamemode = "TEM";
      settings.teamdist = [1,1,0,0];
      await game.collection('chat').add({
        message: "Gamemode is now set to Teams (TEM).",
        senderID: "0",
        senderName: "[ System ]",
        timestamp: firebase.firestore.Timestamp.now(),
        spectate: false
      });
    } else {
      settings.gamemode = "FFA";
      settings.teamdist = [0,0,0,0];
      await game.collection('chat').add({
        message: "Gamemode is now set to Free For All (FFA).",
        senderID: "0",
        senderName: "[ System ]",
        timestamp: firebase.firestore.Timestamp.now(),
        spectate: false
      });
    }
    game.set(settings, {merge: true});
  }

  const switchTeams = () => {
    if (gameState.gamemode !== "TEM" || playerIndex === -1) return;
    var newlist = gameState.teamdist.slice();
    newlist[playerIndex] = 1 - newlist[playerIndex];
    game.set({
      teamdist: newlist
    }, {merge: true});
  }

  if (gameState && !loading && !error) {
    var players = [];
    for (let i = 0; i < gameState.playercount; i++) {
      players.push(
        <React.Fragment key={gameState.players[i]}>
          <div key={gameState.playernames[i]} className="rbwrapper" style={{
            backgroundColor: (gameState.gamemode === "FFA" ? "white" : (gameState.teamdist[i] ? "rgb(255,200,200)" : "cyan")),
            fontWeight: (i === playerIndex ? "bold" : "normal")
          }}>{gameState.playernames[i]}</div>
        </React.Fragment>
      )
    }
    return (
      <React.Fragment>
        <Dialog gd={dialogMessage} sd={setDialog} />
        <Chat context="lobby" game={game} isSpectator={spectator} gameStarted={false}/>
        <GamehostStatus hidden={false} />
        <h1> { gameState.roomname } </h1>
        { gameState.winner && 
          <h2> 
            <span style={{fontWeight: "normal"}}>Winner: </span>
              {gameState.winner}
            <span style={{fontWeight: "normal"}}> with </span>
             {gameState.winnerscore}
            <span style={{fontWeight: "normal"}}> points!</span>
          </h2>
        }
        
        <div style={{fontWeight: "bold", margin: "10px"}}>Players:</div>
        
        { players }

        { spectator ? null : <button onClick={startGame}>Start Game</button> }
        <button onClick={switchGame}>{spectator ? "Switch to Player" : "Switch to Spectator"}</button>
        { spectator ? null : <React.Fragment>
          <button onClick={toggleGamemode} disabled={gameState.playercount !== 4}>Gamemode: {gameState.gamemode}</button>
          { gameState.gamemode === "TEM" && <button onClick={switchTeams}>Switch Teams</button> }
        </React.Fragment> }
        <button onClick={leaveGame}>Leave Game</button>
      </React.Fragment>
    )
  } else {
    return (
      <React.Fragment>
      </React.Fragment>
    )
  }
}

function RoomOption(props) {
  const data = props.rm.data()
  const isProtected = data["password"] === "";
  const nojoin = data["playercount"] === 4;
  if (!auth.currentUser) {
    return (<React.Fragment>
      An unexpected error occurred - ROOMOPTION component.
    </React.Fragment>)
  }
  return (
    <React.Fragment>
      <div className="rbwrapper">
        <div className={"roombutton" + (nojoin ? " nojoin" : "")} onClick={props.join}>
          <div className={"roominfo" + (nojoin ? " nojoin" : "")}>
            <div style={{fontSize: "2em", fontWeight: "bold"}}>{data["roomname"]}</div>
            <div style={{fontSize: "1.5em"}}>{data["roomcreator"]}</div>
            <div style={{fontSize: "1em", fontStyle: "italic", color: "lightgray"}}>Room ID: {props.rm.id}</div>
          </div>
          <div className="roomstats">
            <div style={{flexGrow: "1"}}><b>{data["playercount"]}</b>/4 Players</div>
            <div style={{flexGrow: "1"}}>{isProtected ? "Public" : "Protected"}</div>
            <div style={{flexGrow: "1"}}>{data["started"] ? "In Game" : "In Lobby"}</div>
          </div>
        </div>
      </div>
    </React.Fragment>
  )
}

function App() {
  const [user] = useAuthState(auth);
  const [gameID, setGame] = useState(null);
  const [username, setUsername] = useState("Anonymous");
  return (
    <div className="App">
      {
        (user) ? (gameID ? <NetworkGame gameID={gameID} setGame={setGame}/> : <RoomSelect username={username} setGame={setGame} setName={setUsername} />) : <Login setter={setUsername}/>
      }
    </div>
  );
}

export default App;

