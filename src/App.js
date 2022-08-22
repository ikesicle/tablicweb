import twlogo from './logo.png';
import './App.css';
import { Deck, generateTurnOrder, ranNum } from './tablic.js'
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useDocumentData, useCollection, useDocument } from 'react-firebase-hooks/firestore';
import { firebaseConfig, server } from './cfg.js';
import { useInterval, useLocale } from './chooks.js';
import { Dialog, GameRenderer } from './renderer.js';
import Tutorial from './tutorial.js';
import { text, fmt, setLocale, currentLocale, locales } from './locales.js';
import DOMPurify from 'dompurify';
import { motion, AnimatePresence } from "framer-motion";


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const firestore = firebase.firestore();
const gamehost = server + "/gamehost";
const purify = DOMPurify.sanitize;
const opacityIn = { opacity: 1 };
const opacityOut = { opacity: 0 };

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
    <div className="statusbox" style={{border: "2px solid", borderColor: status ? "green" : "red", backgroundColor: status ? "rgba(0,255,0,0.2)" : "rgba(255,0,0,0.2)"}}>
      {text.UIText.Status}<span style={{fontWeight: "bold"}}>{status ? text.UIText.Online : text.UIText.Offline}</span>
    </div>
  </React.Fragment>
  );
  return (
    <React.Fragment>
    </React.Fragment>
  );
}

function LanguageSelect(props) {
  var langoptions = [];
  Object.getOwnPropertyNames(locales).forEach(lang=>{
    langoptions.push(<option key={lang} value={lang} defaultValue={currentLocale === lang}>{lang}</option>)
  });
  return (<React.Fragment>
    <select name="lang" id="lang" className="langselectbar" onChange={(e)=>{
        setLocale(e.target.value);
        props.postChange(text.Dialogs.OnLangChange || "Language successfully changed!");
    }}>
      { langoptions }
    </select>
  </React.Fragment>)
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
          <li dangerouslySetInnerHTML={{__html: text.Guidebook.Rules1}}/>
          <li dangerouslySetInnerHTML={{__html: text.Guidebook.Rules2}}/>
          <li dangerouslySetInnerHTML={{__html: text.Guidebook.Rules3}}/>
          <li dangerouslySetInnerHTML={{__html: text.Guidebook.Rules4}}/>
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
            <td>{text.Guidebook.SymbolNumbers}</td>
            <td>{text.Guidebook.ValueNumbers}</td>
          </tr>
          <tr>
            <td>{text.Guidebook.SymbolA}</td>
            <td dangerouslySetInnerHTML={{__html: text.Guidebook.ValueA}}/>
          </tr>
          <tr>
            <td>{text.Guidebook.SymbolJ}</td>
            <td>12</td>
          </tr>
          <tr>
            <td>{text.Guidebook.SymbolQ}</td>
            <td>13</td>
          </tr>
          <tr>
            <td>{text.Guidebook.SymbolK}</td>
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
            <td>10 ♦</td>
            <td>2</td>
          </tr>
          <tr>
              <td>2 ♣</td>
              <td>1</td>
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
        <button className="csopen" onClick={()=>{setNav(!navOpen); setOpen(false);}}>{text.Inputs.Guidebook}</button>
        <div className="csnavsub" style={ navOpen ? {} : {width: 0}}>
          <button onClick={()=>{setOpen(true);setTab(0);}}>{text.Inputs.RulesTab}</button>
          <button onClick={()=>{setOpen(true);setTab(1);}}>{text.Inputs.ValuesTab}</button>
          <button onClick={()=>{setOpen(true);setTab(2);}}>{text.Inputs.PointsTab}</button>
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
          <Chat gameStarted={true} isSpectator={spectator} game={game} context={"ingame"}/>
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

function DebugChat(props) {
  const [ messageValue, setMessage ] = useState("");
  const [ chatState, setChatState ] = useState(false);
  const top = useRef(null);
  const toggleOpenClose = (e) => { setChatState(!chatState); }

  return (<React.Fragment>
    <div className={"chatarea "+props.context} >
      <form className="chatform" onSubmit={(e)=>{e.preventDefault()}}>
        <input type="text" className="chatinput" value={messageValue} onChange={e => setMessage(e.target.value)} placeholder={text.Inputs.ChatTypePrmpt} />
        <input type="button" className="chattoggle" onClick={toggleOpenClose} value="Open/Close" />
      </form>

      <div className={"chatlogs "+props.context} style={chatState ? {} : {height: '0', opacity: '0'}}>
        <div ref={top}></div>
          {text.MiscText.DebugChatInfo}
        <div className="message" style={{textAlign: "center"}}>-- {text.UIText.ChatLimit} --</div>
        <div style={{height: "3vh"}}>------</div>
      </div>
    </div>
  </React.Fragment>);
}

function Login(props) {
  const [formValue, setFormValue] = useState('');
  const [dialog, setDialog] = useState(null);

  const login = async (e) => {
    e.preventDefault();
    const regex = /^[a-zA-Z0-9 _]+$/i;
    if (formValue.length > 15) {
      setDialog(text.Dialogs.NameTooLong);
      return;
    }
    if (!regex.test(formValue)) {
      setDialog(text.Dialogs.NameInvalidChars);
      return;
    }
    await auth.signInAnonymously().then(async (ucred) => {
      await ucred.user.updateProfile({displayName: formValue});
      var userdataref = await firestore.collection('userstates').doc(ucred.user.uid);
      if (!(await userdataref.get().exists)) {
        await userdataref.set({
          inGame: "",
          themePref: "",
          lastlogin: null
        });
      }
      await userdataref.set({
        lastlogin: firebase.firestore.Timestamp.now()
      }, {merge: true})
    });
    props.setter(formValue);
  }
  
  return (
    <React.Fragment>
      <Dialog gd={dialog} sd={setDialog} />
      <img src={twlogo} alt="Logo" className="applogo"></img>
      <form onSubmit={login}>
        <input value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder={text.Inputs.LoginPlaceholder} style={{
          height: "1.5em",
          margin: "1.5em",
          border: "1px solid black",
          padding: "3px"
        }} />
        <button type="submit" disabled={!formValue} style={{
          height: "2.1em",
          padding: "3px"
        }}>{text.Inputs.LoginBtn}</button>
      </form>

      <LanguageSelect postChange={setDialog}/>
      <GamehostStatus hidden={false} />
      <div className="credits">{text.MiscText.Credits}</div>
    </React.Fragment>
  )
}

function Chat(props) {
  const [ messageValue, setMessage ] = useState("");
  const [ chatState, setChatState ] = useState(false);
  const top = useRef(null);
  const gamechat = props.game.collection('chat');
  var filter = gamechat.orderBy("timestamp", "desc");
  filter = filter.limit(50);
  const [ gamechatref, loading, error ] = useCollection(filter);
  const [ user ] = useAuthState(auth)

  const send = async (e) => {
    e.preventDefault();
    if (!messageValue) return;
    var sendtime = firebase.firestore.Timestamp.now();
    await gamechat.add({
      message: messageValue,
      senderID: user.uid,
      senderName: user.displayName,
      timestamp: sendtime,
      spectate: props.isSpectator
    })
    await props.game.set({
      lastactivity: sendtime
    }, {merge: true})
    setChatState(true);
    if (gamechatref.docs.length > 50) { // Message limit
      await gamechat.doc(gamechatref.docs[0].id).delete()
    }
    setMessage("");
    top.current.scrollIntoView({behavior: "smooth"});
  }

  const toggleOpenClose = (e) => { setChatState(!chatState); }

  var ctr = -1;
  var chat;
  if (error) chat = text.MiscText.ErrorChat;
  else if (loading) chat = text.UIText.Loading;
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
          <input type="text" className="chatinput" value={messageValue} onChange={e => setMessage(e.target.value)} placeholder={text.Inputs.ChatTypePrmpt} />
          <input type="button" onClick={toggleOpenClose} value={text.Inputs.ChatToggle} />
        </form>

        <div className={"chatlogs "+props.context} style={chatState ? {} : {height: '0', opacity: '0'}}>
          <div ref={top}></div>
          {chat}
          <div className="message" style={{textAlign: "center"}}>-- {text.UIText.RecordsEnd} --</div>
          <div style={{height: "3vh"}}>------</div>
        </div>
      </div>
    </React.Fragment>
  )
}

function RoomSelect(props) {
  const [user] = useAuthState(auth);
  const roomlist = firestore.collection('rooms');
  const userstatus = !user ? null : firestore.collection('userstates').doc(user.uid);
  const [rooms, loadingRoom, roomError] = useCollection(roomlist);
  const [userinfo] = useDocumentData(userstatus);
  const [dialog, setDialog] = useState(null)
  const [scene, setScene] = useState("");
  const [rc, setRc] = useState(false);

  const joinRoom = async (rm) => {
    console.log(`Logging in to room '${rm}'`)
    const game = roomlist.doc(rm)
    const gamedata = (await game.get()).data();
    var msg = fmt(text.SystemChatMessages.UserSpectate, {user: user.displayName});
    if (!userinfo) return;
    if (user && gamedata) {
      if (gamedata["playercount"] < 4 && gamedata["players"].indexOf(user.uid) === -1 && !gamedata["started"] && userinfo.inGame === "") {
        await game.set({
          players: gamedata["players"].concat([user.uid]),
          playernames: gamedata["playernames"].concat([user.displayName]),
          playercount: gamedata["playercount"] + 1,
        }, {
          merge: true
        });
        msg = fmt(text.SystemChatMessages.JoinRoom, {user: user.displayName});
        await game.collection('chat').add({
          message: msg,
          senderID: "0",
          senderName: "[ System ]",
          timestamp: firebase.firestore.Timestamp.now(),
          spectate: false
        });
        await userstatus.set({
          inGame: rm
        }, {merge: true});
      }
      else if (gamedata["players"].indexOf(user.uid !== -1) && userinfo.inGame === rm) {
        await userstatus.set({
          inGame: rm
        }, {merge: true});
      }
      else {
        await game.collection('chat').add({
          message: msg,
          senderID: "0",
          senderName: "[ System ]",
          timestamp: firebase.firestore.Timestamp.now(),
          spectate: false
        });
        await game.set({
          lastactivity: firebase.firestore.Timestamp.now()
        }, {merge: true});
      }
      props.setGame(rm);
    }
    else if (!(gamedata)) {
      setDialog(text.MiscText.ErrorLoadRoom);
      await userstatus.set({
        inGame: ""
      }, {merge: true});
    }
  };

  const createGame = async () => {
    if (rc || !userinfo) { 
      setDialog(text.MiscText.ErrorLoadUser)
      return;
    }
    if (userinfo.inGame !== "") {
      setDialog(text.MiscText.ErrorMultipleRooms)
      return;
    }
    setRc(true);
    await roomlist.add({ // CHECKED
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
      roomname: fmt(text.MiscText.DefaultRoomName, {user: user.displayName}),
      started: "",
      talon: [],
      talonprev: [],
      turn: 0,
      winner: "",
      password: "",
      gamemode: "FFA",
      teamdist: [0,0,0,0],
      roomcreator: user.displayName,
      date: firebase.firestore.Timestamp.now(),
      lastactivity: firebase.firestore.Timestamp.now(),
      turnorder: [],
      roomflags: []
    }).then(async (docRef) => {
      console.log("Creating chat logs")
      await docRef.collection('chat').add({
        message: fmt(text.SystemChatMessages.RoomCreate, { time: String(firebase.firestore.Timestamp.now().toDate())}),
        senderID: "0",
        senderName: "[ System ]",
        timestamp: firebase.firestore.Timestamp.now(),
        spectate: false
      });
      await joinRoom(docRef.id).then(()=>{setRc(false);});
    });
  };

  var rmav;

  if (roomError) {
    rmav = (<React.Fragment>
      {fmt(text.MiscText.ErrorComponent, {component: "RoomSelect"})}
    </React.Fragment>)
  }
  else if (loadingRoom) {
    rmav = (
      <React.Fragment>
        <div>{text.UIText.Loading}</div>
      </React.Fragment>
    )
  }
  else {
    rmav = rooms.docs.length > 0 ? rooms.docs.map(rm => (
      <motion.div key={rm.id} className="rbwrapper" initial={{x: -200, opacity: 0}} animate={{x: 0, opacity: 1}} exit={{x: 200, opacity: 0}}>
        <RoomOption join={async() => joinRoom(rm.id)} rm={rm} />
      </motion.div>
    )) : (
        <div style={{
        fontSize: "15px",
        fontStyle: "italic",
        margin: "10px"
      }}>{text.UIText.NoRooms}</div>
    );
  }
  var content;

  switch (scene) {
    case "tutorial":
      content = (
        <motion.div key="tutorial" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
          <Tutorial exit={()=>{
            setScene("");
          }} user={user}/>
        </motion.div>
      )
      break;
    case "debug":
      content = (
        <motion.div key="debug" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
          <DebugGame exit={()=>{
          setScene("");
          }} />
        </motion.div>
      );
      break;
    default:
      content = (
        <motion.div key="roomselection" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
          <div className="roomscroll">
            <div className="stickied">
              <h1>
                {fmt(text.UIText.WelcomeText, {user: user ? (user.displayName || props.username) : "Anonymous"})}
              </h1>
              <button onClick={async () => {
                props.setName(null);
                await userstatus.delete();
                await auth.currentUser.delete();
                await auth.signOut();
              }}>{text.Inputs.LogOff}</button>
              <button onClick={createGame}>{text.Inputs.NewGame}</button>
              <button onClick={()=>{
                setScene("tutorial");
              }}>{text.Inputs.Tutorial}</button>
              <button onClick={()=>{
                setScene("debug");
              }}>{text.Inputs.DebugLayout}</button>
              {
                userinfo && userinfo.inGame !== "" ? (<p>
                  {text.UIText.CurrentRoomText} <button onClick={()=>{joinRoom(userinfo.inGame)}}>{userinfo.inGame}</button>
                </p>) : null
              }
              <h2>{text.UIText.AvailableRooms}</h2>
            </div>
            <AnimatePresence exitBeforeEnter>
              {rmav}
            </AnimatePresence>
          </div>
          <Dialog gd={dialog} sd={setDialog} />

          <LanguageSelect postChange={setDialog}/>
          <GamehostStatus hidden={false} />
        </motion.div>
      );
      break;
  }
  return (
    <AnimatePresence exitBeforeEnter>
      {content}
    </AnimatePresence>
  )
}

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
      date: firebase.firestore.Timestamp.now(),
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
      timestamp: firebase.firestore.Timestamp.now(),
      spectate: false
    });
    game.collection('chat').add({
      message: fmt(text.SystemChatMessages.TurnOrder, {torderstring: toMSG}),
      senderID: "0",
      senderName: "[ System ]",
      timestamp: firebase.firestore.Timestamp.now(),
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
        timestamp: firebase.firestore.Timestamp.now(),
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
        timestamp: firebase.firestore.Timestamp.now(),
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
            timestamp: firebase.firestore.Timestamp.now(),
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
        timestamp: firebase.firestore.Timestamp.now(),
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
        timestamp: firebase.firestore.Timestamp.now(),
        spectate: false
      });
    } else {
      settings.gamemode = "FFA";
      settings.teamdist = [0,0,0,0];
      await game.collection('chat').add({
        message: fmt(text.SystemChatMessages.ToggleGamemode, {gamemode: "Free For All (FFA)"}),
        senderID: "0",
        senderName: "[ System ]",
        timestamp: firebase.firestore.Timestamp.now(),
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

function App() {
  const [user] = useAuthState(auth);
  const [gameID, setGame] = useState(null);
  const [username, setUsername] = useState("Anonymous");

  var content;
  if (user) {
    if (gameID) {
      content = (
        <motion.div key="game" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
          <NetworkGame gameID={gameID} setGame={setGame}/>
        </motion.div>
      );
    } else {
      content = (
        <motion.div key="roomselection" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
          <RoomSelect username={username} setGame={setGame} setName={setUsername} />
        </motion.div>
      );
    }
  }
  else {
    content = (
      <motion.div key="login" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
        <Login setter={setUsername}/>
      </motion.div>
    );
  }
  return (
    <div className="App">
      <AnimatePresence exitBeforeEnter>
        { content }
      </AnimatePresence>
    </div>
  );
}

export default App;

