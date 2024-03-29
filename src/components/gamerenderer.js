import React, { useState, useEffect } from 'react';
import cardcount from 'assets/cardcount.png';
import cardcap from 'assets/cardcap.png';
import { verifyCap, Card, evaluatePoints } from 'util/tablic.js';
import anime from 'util/anime.es.js';
import { text, fmt } from 'util/locales.js';
import DOMPurify from 'dompurify';

import CardDisplay from './game/carddisplay.js';
import GameAnimCtx from './game/animcontext.js';
import Hand from './game/hand.js';
import Talon from './game/talon.js';
import Dialog from './dialog.js';


const cardinal = ["east ", "north ", "west "];

function GameRenderer(props) {
  const [ spectatorView, setView ] = useState(0);
  const getDialog = props.getDialog;
  const setDialog = props.setDialog;
  const gameState = props.gameState;
  const spectating = props.spectating;
  const playerIndex = spectating ? spectatorView : props.playerID;
  const [ selectedHand, selectHand ] = useState(null);
  const [ selectedTalon, selectTalon ] = useState(Array(0));
  const [ currentAnimation, setAnimation ] = useState(null);
  const [ animatedObjects, setObjects ] = useState(null);
  
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
      setDialog(text.Dialogs.SelectCard);
      return;
    }


    if (actiontype === "capture" && !verifyCap(selectedTalon.map(crd => (new Card(crd)).value()), (new Card(selectedHand)).value())) {
      setDialog(text.Dialogs.InvalidCombo)
      return;
    }

    await Promise.resolve(props.onPlay(actiontype, selectedHand, selectedTalon));

    selectTalon(Array(0));
    selectHand(null);
  };

  useEffect(() => {
    if (!(gameState && gameState.lastPlay)) return;
    let command = gameState.lastPlay.split(' ');
    switch (command[0]) {
      case 'capture':
        if (command.length < 2) break;
        let obj = [];
        let tl = [{easing: "linear", duration: 500}];
        let lpos;
        for (let i = 2; i < command.length; i++) {
          lpos = (gameState.talonprev.indexOf(command[i])+1) / (gameState.talonprev.length + 1) * 70 + 15;
          obj.push(<CardDisplay key={i} type={command[i]} selected={false} cstyle={{
            left: "calc(" + String((lpos).toPrecision(4)) + "% - 7.7vh",
            bottom: "43vh",
            position: "fixed",
            opacity: 1,
            border: "2px solid darkgray",
            zIndex: 5,
            transition: "0s"
          }}/>)
        }
        obj.push(<CardDisplay key="played" type={command[1]} selected={false} cstyle={{
          position: "fixed",
          bottom: "0",
          left: "calc(50vw - 7vh)",
          border: "2px solid darkgray",
          zIndex: 5,
          opacity: 0,
          transition: "0s"
        }}/>);

        obj.push(<div className="pointscard" style={{transform: "scaleX(0)"}}>+{evaluatePoints(command.slice(1))}</div>)

        if (gameState.talon.length === 0 && gameState.started === "play") {
          obj.push(<div className="allclear">{text.MiscText.AllClear}</div>)
        }

        setObjects(obj);

        tl.push({
          targets: '.animation .crdcontainer',
          easing: "easeInOutQuad",
          left: 'calc(50vw - 7vh)',
          bottom: '42.5vh',
          opacity: 1,
          delay: anime.stagger(100)
        })

        tl.push({
          targets: '.animation .crdcontainer',
          scaleX: 0,
          duration: 200,
          easing: "easeInQuad"
        })

        tl.push({
          targets: '.animation .pointscard',
          scaleX: 1,
          duration: 200,
          easing: "easeOutQuad"
        })

        tl.push({
          targets: '.animation .crdcontainer, .animation .crdcontainer > .card, .animation .pointscard',
          easing: "easeInQuad",
          opacity: 0,
          duration: 500,
          delay: 1000,
          complete: gameState.talon.length === 0 && gameState.started === "play" ? ()=>{} : ()=>{
            setObjects([]); 
            setAnimation(null); }
        });

        if (gameState.talon.length === 0 && gameState.started === "play") {
          tl = tl.concat([{
            targets: '.animation .allclear',
            easing: "easeOutQuad",
            scaleX: 1,
            opacity: 1,
            duration: 300
          },{
            targets: '.animation .allclear',
            easing: "easeInOutQuad",
            scaleX: 0,
            duration: 100,
            delay: 200,
            complete: () => {document.querySelector('.animation .allclear').textContent = "+1";}
          },{
            targets: '.animation .allclear',
            easing: "easeInOutQuad",
            scaleX: 1,
            duration: 100
          },{
            targets: '.animation .allclear',
            easing: "easeInOutQuad",
            opacity: 0,
            duration: 300,
            delay: 1000,
            complete: (anim) => {
            setObjects([]); 
            setAnimation(null); }
          }]);
        }
        setAnimation(tl);
        break;


      default:
        break;
    }
  }, [gameState && gameState.lastPlay]);
  
  if (gameState) {
    const yourHand = gameState["p" + String(playerIndex+1) + "hand"];
    const cpturn = gameState.turnorder[gameState.turn];
    const isYourTurn = playerIndex === cpturn;
    var playerdata = [];
    var teamcolors = gameState.gamemode === "TEM" ? gameState.teamdist.map(x => x ? " blue" : " red") : ["","","",""]
    playerdata.push(
      <React.Fragment key="south ">
        <div className={
          "south playershadow"
          + teamcolors[playerIndex] 
        }>
          <div 
            className={
              "player"
              + (spectating ? " spectate" : "")
              + (isYourTurn ? " np" : "")
            }
          >
            <div style={{fontWeight: "bold", fontSize: "2vh"}}>{gameState.playernames[playerIndex]}</div>
            <div className="stats">
              <div className="pointcounter">
                <span style={{fontSize: "6vh", fontWeight: "bold"}}>{gameState.points[playerIndex]}</span>{text.UIText.PointsAbbrv}
              </div>
              <div className="cardcount">
                  <div className="carddata">
                    {yourHand.length}
                    <img src={cardcount} alt="Cards in hand" className="cdisplay" />
                  </div>
                  <div className="carddata">
                    {gameState.capturecount[playerIndex]}
                    <img src={cardcap} alt="Cards captured" className="cdisplay" />
                  </div>
                </div>
            </div>
          </div>
        </div>
      </React.Fragment>
    )
    let dir = 0;
    for (let i = 1; i < gameState.playercount; i++) {
      let ti = gameState.turnorder.indexOf(playerIndex);
      let pid = gameState.turnorder[(ti + i) % gameState.playercount];
      playerdata.push(
        <React.Fragment key={cardinal[dir]}>
          <div className={
            cardinal[dir]
            + "playershadow"
            + teamcolors[pid]
          }>
            <div 
              className={
                "player"
                + (spectating ? " spectate" : "")
                + (pid === cpturn ? " np" : "")
              }
              onClick={()=>{spectatorSwitch(pid)}}
            >
              <div style={{fontWeight: "bold", fontSize: "2vh"}}>{gameState.playernames[pid]}</div>
              <div className="stats">
                <div className="pointcounter">
                  <span className="pcnum">{gameState.points[pid]}</span>{text.UIText.PointsAbbrv}
                </div>
                <div className="cardcount">
                  <div className="carddata">
                    {gameState["p" + String(pid+1) + "hand"].length}
                    <img src={cardcount} alt="Cards in hand" className="cdisplay" />
                  </div>
                  <div className="carddata">
                    {gameState.capturecount[pid]}
                    <img src={cardcap} alt="Cards captured" className="cdisplay" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </React.Fragment>
      )
      dir++;
    }
    return (
      <React.Fragment>
        <GameAnimCtx animation={currentAnimation} content={animatedObjects} />
        <Dialog gd={getDialog} sd={setDialog} />
        <Hand data={yourHand} selectHand={spectating ? ()=>{} : selectHand} selectedHand={spectating ? [] : selectedHand}/>
        { spectating ? (<div className="spectating">Spectating {gameState.playernames[playerIndex]}</div>) : <button className="pushaction" onClick={preprocess} disabled={gameState.turnorder[gameState.turn] !== playerIndex}>{ selectedTalon.length === 0 ? text.Inputs.PlayCard : text.Inputs.CaptureCard}</button> }
        
        { playerdata }

        { <Talon className="talon" data={gameState.talon} selectTalon={spectating ? ()=>{} : selectTalon} selectedTalon={spectating ? [] : selectedTalon} /> }
        
        <div className={"turnindicator" + (isYourTurn ? " current" : "")} >
          { gameState.started === "play" ? (isYourTurn && !spectating ? text.UIText.YourTurn : fmt(text.UIText.OtherTurn, {name: gameState.playernames[cpturn]})) : text.UIText.GoodGame }
        </div>

        <div className={"turntimer" + (isYourTurn ? " current" : "")}>
          { gameState.started === "ending" ? text.UIText.GameEnd : props.time }
        </div>
      </React.Fragment>
    )
  } else return null;
}

export default GameRenderer;