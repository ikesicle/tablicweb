import React, { useState, useEffect } from 'react';
import { cards } from './cards.js';
import cardcount from './cardcount.png';
import cardcap from './cardcap.png';
import { verifyCap, Card, evaluatePoints } from './tablic.js';
import anime from './anime.es.js';


const cardinal = ["east ", "north ", "west "];
const portraitcoords = {
  north: {
    left: "calc(16.5vw - 7vh)",
    bottom: "72vh"
  },
  east: {
    left: "calc(49.5vw - 7vh)",
    bottom: "72vh"
  },
  west: {
    left: "calc(82.5vw - 7vh)",
    bottom: "72vh"
  }
};
const landscapecoords = {
  north: {
    left: "calc(10vw + 160px - 7vh)",
    bottom: "70vh"
  },
  east: {
    left: "calc(10vw + 50px - 7vh)",
    bottom: "70vh"
  },
  west: {
    left: "calc(10vw + 270px - 7vh)",
    bottom: "70vh"
  }
};

function Dialog(props) {
  return (
    <div className="dialog" style={props.gd ? {opacity: "1"} : {top: "-40vh", opacity: "0"}}>
      <div style={{flexGrow: "10"}}> {props.gd} </div>
      <button className="closedialog" onClick={()=>props.sd(null)}>Ok</button>
    </div>
  );
}

function CardVis(props) {
  let cstyle = props.cstyle;
  if (!cstyle.bottom) cstyle.bottom = props.selected ? "10%" : "5%";
  return (
    <div className={"crdcontainer" + (props.selected ? " selectborder" : "")} style={cstyle} value={props.type} onClick={()=>{
      props.onClick(props.type);
    }}>
      <img src={cards[props.type]} alt={Card.parse(props.type)} className="card" />
    </div>
  )
}

function Talon(props) {
  var cnt = 1;
  return (
      <div className="talon-grid">
        <div className="sectionlabel">Talon</div>
        {props.data && props.data.map(
          crd => <CardVis key={cnt} type={crd} selected={(props.selectedTalon.indexOf(crd) !== -1)} cstyle={{
            left: "calc(" + String(((cnt++) / (props.data.length + 1) * 70 + 15).toPrecision(4)) + "% - 7.7vh",
            animation: "card-creation 0.4s ease-out"
          }}
          onClick={() => {
            var k = props.selectedTalon.slice();
            if (k.indexOf(crd) === -1) k.push(crd);
            else k.splice(k.indexOf(crd), 1);
            props.selectTalon(k);
          }} />
        )}
      </div>
    )
}

function Hand(props) {
  let cindex = 0;
  let startingoffset = 37.5-2.5*(props.data.length-1);
  return (
    <div className="player-hand">
      <div className="sectionlabel">Hand</div>
      {props.data && props.data.map( crd =>
        <CardVis key={cindex} type={crd} selected={(props.selectedHand === crd)} 
        cstyle={{
          left: "calc(" + String(startingoffset + (cindex++) * 5) + "% - 7.7vh)",
          animation: "card-creation 0.4s ease-out",
          zIndex: 7
        }}
        onClick={props.selectHand} st={props.selectedHand}/>
      )}
    </div>
  )
}

function AnimationContext(props) {
  const [ currentAnimation, setCurrentAnimation ] = useState([]);
  useEffect(() => {
    if (props.animation) {
      let tl = anime.timeline(props.animation[0]);
      for (let i = 1; i < props.animation.length; i++) 
        if (!("length" in props.animation[i])) tl.add(props.animation[i]);
        else tl.add(props.animation[i][0], props.animation[i][1]);

      setCurrentAnimation(tl);
      tl.restart();
    }
  }, [props.content]);
  return (<>
    <div className="animation">
      {props.content}
    </div>
  </>)
}

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
      setDialog("Select a card to play first!");
      return;
    }


    if (actiontype === "capture" && !verifyCap(selectedTalon.map(crd => (new Card(crd)).value()), (new Card(selectedHand)).value())) {
      setDialog("Invalid Card Combination!")
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
        let obj = [];
        let tl = [{easing: "linear", duration: 500}];
        let lpos;
        for (let i = 2; i < command.length; i++) {
          lpos = (gameState.talonprev.indexOf(command[i])+1) / (gameState.talonprev.length + 1) * 70 + 15;
          obj.push(<CardVis key={i} type={command[i]} selected={false} cstyle={{
            left: "calc(" + String((lpos).toPrecision(4)) + "% - 7.7vh",
            bottom: "43vh",
            position: "fixed",
            opacity: 1,
            border: "2px solid darkgray",
            zIndex: 5,
            transition: "0s"
          }}/>)
        }
        obj.push(<CardVis key="played" type={command[1]} selected={false} cstyle={{
          position: "fixed",
          bottom: "0",
          left: "calc(50vw - 7vh)",
          border: "2px solid darkgray",
          zIndex: 5,
          opacity: 0,
          transition: "0s"
        }}/>);

        obj.push(<div className="pointscard" style={{transform: "scaleX(0)"}}>+{evaluatePoints(command.slice(1))}</div>)

        if (gameState.talon.length === 0) obj.push(<div className="allclear">All Clear</div>)
        
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
          complete: gameState.talon.length === 0 ? ()=>{} : (anim) => {
            setObjects([]); 
            setAnimation(null); }
        });

        if (gameState.talon.length === 0) {
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
    const isYourTurn = playerIndex === gameState.turnorder[gameState.turn];
    var playerdata = [];
    playerdata.push(
      <React.Fragment key={playerIndex}>
        <div className={"south player" + (spectating ? " spectate" : "")}>
          <div style={{fontWeight: "bold", fontSize: "2vh"}}>{gameState.playernames[playerIndex]}</div>
          <div className="stats">
            <div className="pointcounter">
              <span style={{fontSize: "6vh", fontWeight: "bold"}}>{gameState.points[playerIndex]}</span> PTS
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
      </React.Fragment>
    )
    let dir = 0;
    for (let i = 1; i < gameState.playercount; i++) {
      let ti = gameState.turnorder.indexOf(playerIndex);
      let pid = gameState.turnorder[(ti + i) % gameState.playercount];
      playerdata.push(
        <React.Fragment key={pid}>
          <div className={cardinal[dir]+"player"+ (spectating ? " spectate" : "")} onClick={()=>{spectatorSwitch(pid)}}>
            <div style={{fontWeight: "bold", fontSize: "2vh"}}>{gameState.playernames[pid]}</div>
            <div className="stats">
              <div className="pointcounter">
                <span className="pcnum">{gameState.points[pid]}</span> PTS
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
        </React.Fragment>
      )
      dir++;
    }
    return (
      <React.Fragment>
        <AnimationContext animation={currentAnimation} content={animatedObjects} />
        <Dialog gd={getDialog} sd={setDialog} />
        <Hand data={yourHand} selectHand={spectating ? ()=>{} : selectHand} selectedHand={spectating ? [] : selectedHand}/>
        { spectating ? (<div className="spectating">Spectating {gameState.playernames[playerIndex]}</div>) : <button className="pushaction" onClick={preprocess} disabled={gameState.turnorder[gameState.turn] !== playerIndex}>{ selectedTalon.length === 0 ? "Play" : "Capture"}</button> }
        
        { playerdata }

        <Talon className="talon" data={gameState.talon} selectTalon={spectating ? ()=>{} : selectTalon} selectedTalon={spectating ? [] : selectedTalon} />
        
        <div className={"turnindicator" + (isYourTurn ? " current" : "")} >
          {isYourTurn && !spectating ? "Your" : gameState.playernames[gameState.turnorder[gameState.turn]] + "'s"} turn
        </div>
        <div className={"turntimer" + (isYourTurn ? " current" : "")}>
          {props.time}
        </div>
      </React.Fragment>
    )
  } else return null;
}

export { Dialog, GameRenderer };