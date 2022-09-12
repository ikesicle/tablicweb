import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import React, { useState, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollection } from 'react-firebase-hooks/firestore';
import { auth } from 'cfg.js';
import { text } from 'util/locales.js';

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

export default Chat;