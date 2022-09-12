import React, {useState, useEffect} from 'react';
import { gamehost } from 'cfg.js';
import { text } from 'util/locales.js';

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

export default GamehostStatus;