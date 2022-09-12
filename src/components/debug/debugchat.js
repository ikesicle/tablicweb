import React, { useState, useRef } from 'react';
import { text } from 'util/locales.js';

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

export default DebugChat;