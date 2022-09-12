import React, {useState} from 'react';
import firebase from 'firebase/compat/app';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, firestore, opacityIn, opacityOut } from 'cfg.js';
import { useDocumentData, useCollection } from 'react-firebase-hooks/firestore';
import { fmt, text } from 'util/locales.js';
import { motion, AnimatePresence } from 'framer-motion';

import RoomOption from './roomoption.js';
import Tutorial from './tutorial/tutorial.js';
import DebugGame from './debug/debuggame.js';
import Dialog from './dialog.js';
import LanguageSelect from './langsel.js';
import GamehostStatus from './gamestatus.js';


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

export default RoomSelect;