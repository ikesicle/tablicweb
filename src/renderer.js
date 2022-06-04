import React, { useState } from 'react';
import { cards } from './cards.js';
import cardcount from './cardcount.png';
import { verifyCap, Card } from './tablic.js';

const cardinal = ["east ", "north ", "west "];

function Dialog(props) {
  return (
    <div className="dialog" style={props.gd ? {opacity: "1"} : {top: "-40vh", opacity: "0"}}>
      <div style={{flexGrow: "10"}}> {props.gd} </div>
      <button className="closedialog" onClick={()=>props.sd(null)}>Ok</button>
    </div>
  );
}

function CardVis(props) {
  return (
    <div className={"crdcontainer" + (props.selected ? " selectborder" : "")} style={{
      left: props.hpos, 
      bottom: props.selected ? "10%" : "5%"
    }} value={props.type} onClick={()=>{
      props.onClick(props.type);
    }}>
      <img src={cards[props.type]} alt={Card.parse(props.type)} className="card" />
    </div>
  )
}

function Talon(props) {
  var cnt = 1;
  const dff = (window.innerWidth >= 600 ? 17.5 : 21) / 2;
  return (
      <div className="talon-grid">
        {props.data && props.data.map(
          crd => <CardVis key={cnt} type={crd} selected={(props.selectedTalon.indexOf(crd) !== -1)} hpos={
            "calc(" + String(((cnt++) / (props.data.length + 1) * 70 + 15).toPrecision(4)) + "% - " + String(dff) + (window.innerWidth >= 600 ? "vh)" : "vw)")
          } onClick={() => {
            var k = props.selectedTalon.slice();
            if (k.indexOf(crd) === -1) k.push(crd);
            else k.splice(k.indexOf(crd), 1);
            props.selectTalon(k);
          }} />
        )}
      </div>
    )
}

/*
Displays a hand of cards at the bottom of the screen.
Required Properties
data - array - array of cards
selectedHand - array - array of selected cards
*/
function Hand(props) {
  var cindex = 0;
  const wd = (window.innerWidth >= 600 ? 17.5 : 21);
  const hpos = props.data && 50-wd-2.5*(props.data.length-1);
  return (
    <div className="player-hand" style={{ width: String(wd + 5*(props.data.length-1)) + "vw", left: String(hpos) + "vw"}}>
      {props.data && props.data.map( crd =>
        <CardVis key={cindex} type={crd} selected={(props.selectedHand === crd)} 
        hpos={
          String((cindex++) * 5) + "vw"
        }
        onClick={props.selectHand} st={props.selectedHand}/>
      )}
    </div>
  )
}

/*
Game interface.
*/
function GameRenderer(props) {
  const [ spectatorView, setView ] = useState(0);
  const getDialog = props.getDialog;
  const setDialog = props.setDialog;
  const gameState = props.gameState;
  const spectating = props.spectating;
  const playerIndex = spectating ? spectatorView : props.playerID;
  const [ selectedHand, selectHand ] = useState(null);
  const [ selectedTalon, selectTalon ] = useState(Array(0));
  
  const spectatorSwitch = (pid) => {
    if (!spectating) return;
    setView(pid);
  };

  const preprocess = async () => {
    if (spectating) return;
    for (let i = 0; i < selectedTalon.length; i++) {
      if (gameState.talon.indexOf(selectedTalon[i]) === -1) {
        selectedTalon.splice(i, 1);
        i--;
      }
    }
    const actiontype = selectedTalon.length === 0 ? "play" : "capture";
    if (!selectedHand) {
      setDialog("Select a card to play first!");
    }


    if (actiontype === "capture" && !verifyCap(selectedTalon.map(crd => (new Card(crd)).value()), (new Card(selectedHand)).value())) {
      setDialog("Invalid Card Combination!")
      return;
    }

    await Promise.resolve(props.onPlay(actiontype, selectedHand, selectedTalon));

    selectTalon(Array(0));
    selectHand(null);
  };

  if (gameState) {
    const yourHand = gameState["p" + String(playerIndex+1) + "hand"];
    const isYourTurn = playerIndex === gameState.turn;
    var playerdata = [];
    playerdata.push(
      <React.Fragment key={gameState.players[playerIndex]}>
        <div className="south player">
          <div style={{fontWeight: "bold", fontSize: "2vh"}}>{gameState.playernames[playerIndex]}</div>
          <div className="stats">
            <div className="pointcounter">
              <span style={{fontSize: "6vh", fontWeight: "bold"}}>{gameState.points[playerIndex]}</span> PTS
            </div>
            <div className="cardcount">
              {yourHand.length}
              <img src={cardcount} alt="Cards remaining" height="15" className="cardDisplay" />
            </div>
          </div>
        </div>
      </React.Fragment>
    )
    let dir = 0;
    for (let i = 0; i < gameState.playercount; i++) {
      let pid = (playerIndex + i) % gameState.playercount;
      if (pid === playerIndex) continue;
      playerdata.push(
        <React.Fragment key={pid}>
          <div className={cardinal[dir]+"player"} onClick={()=>{spectatorSwitch(pid)}}>
            <div style={{fontWeight: "bold", fontSize: "2vh"}}>{gameState.playernames[pid]}</div>
            <div className="stats">
              <div className="pointcounter">
                <span style={{fontSize: "6vh", fontWeight: "bold"}}>{gameState.points[pid]}</span> PTS
              </div>
              <div className="cardcount">
                {gameState["p" + String(pid+1) + "hand"].length}
                <img src={cardcount} alt="Cards remaining" height="15" className="cardDisplay" />
              </div>
            </div>
          </div>
        </React.Fragment>
      )
      dir++;
    }
    return (
      <React.Fragment>
        <Dialog gd={getDialog} sd={setDialog} />
        <Hand data={yourHand} selectHand={spectating ? ()=>{} : selectHand} selectedHand={spectating ? [] : selectedHand}/>
        { spectating ? (<div className="spectating">Spectating {gameState.playernames[playerIndex]}</div>) : <button className="pushaction" onClick={preprocess}>{ selectedTalon.length === 0 ? "Play" : "Capture"}</button> }
        
        { playerdata }

        <Talon className="talon" data={gameState.talon} selectTalon={spectating ? ()=>{} : selectTalon} selectedTalon={spectating ? [] : selectedTalon} />
        
        <div className={"turnindicator" + (isYourTurn ? " current" : "")} >
          {isYourTurn && !spectating ? "Your" : gameState.playernames[gameState.turn] + "'s"} turn
        </div>
        <div className={"turntimer" + (isYourTurn ? " current" : "")}>
          {props.time}
        </div>
      </React.Fragment>
    )
  } else return null;
}

export { Dialog, GameRenderer };