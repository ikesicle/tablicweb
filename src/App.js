import logo from './logo.svg';
import './App.css';
import { verifyCap, Deck, Card, ranNum, faces, suits, NUMBER_OF_CARDS } from './tablic.js'
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useDocumentData, useCollectionData, useCollection } from 'react-firebase-hooks/firestore';
import { cards } from './cards.js';
import cardcount from './cardcount.png';
import { firebaseConfig, gamehost } from './cfg.js';
import { useInterval } from './chooks.js';


// Initialize Firebase
const fbase = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth()
const firestore = firebase.firestore()

function GamehostStatus(props) {
  const [ status, setStatus ] = useState(false)
  const updateStatus = async () => {
    const resp = await fetch(gamehost, {headers: {"Origin": window.location.href}}).then(obj=>{
      if (!obj.ok) setStatus(false)
      else setStatus(true)
    }).catch(err=>{
      setStatus(false)
    });
  }
  useEffect(() => { updateStatus() }, []);
  return ( <React.Fragment>
    <div className="statusbox">
      Gamehost - <span style={{fontWeight: "bold"}}>{status ? "Online" : "Offline"}</span>
    </div>
  </React.Fragment>
  )
}

function Dialog(props) {
  return (
    <div className="dialog" style={props.gd ? {opacity: "1"} : {top: "-40vh", opacity: "0"}}>
      <div style={{flexGrow: "10"}}> {props.gd} </div>
      <button className="closedialog" onClick={()=>props.sd(null)}>Ok</button>
    </div>
  );
}

function CardVis(props) {
  const [ selected, setSelect ] = useState(false);
  return (
    <div className={"crdcontainer" + (props.selected ? " selectborder" : "")} style={{
      left: props.hpos, 
      bottom: props.selected ? "5%" : "0%"
    }} value={props.type} onClick={()=>{
      props.onClick(props.type);
    }}>
      <img src={cards[props.type]} className="card" />
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
            "calc(" + String(((cnt++) / (props.data.length + 1) * 100).toPrecision(4)) + "% - " + String(dff) + (window.innerWidth >= 600 ? "vh)" : "vw)")
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

function Game(props) {
  const game = firestore.collection('rooms').doc(props.gameID);
  const [ selectedHand, selectHand ] = useState(null);
  const [ selectedTalon, selectTalon ] = useState(Array(0));
  const [ selectedElements, setSelectedElements] = useState(Array(0));
  const [ dialogMessage, setDialog ] = useState(null);
  const [ gameState, loading, error ] = useDocumentData(game);
  const [ time, setTime ] = useState(0);
  const [ timerSpeed, setSpeed ] = useState(null);
  const [ cAnimation, setAnimation ] = useState(null);
  const [ animationCount, setAnimationCount ] = useState(0);

  var playerIndex, yourHand, isYourTurn;
  if (gameState && !loading && !error && auth.currentUser) {

    playerIndex = gameState.players.indexOf(auth.currentUser.uid);
    switch (playerIndex) {
      case 0:
        yourHand = gameState.p1hand;
        break;
      case 1:
        yourHand = gameState.p2hand;
        break;
      case 2:
        yourHand = gameState.p3hand;
        break;
      case 3:
        yourHand = gameState.p4hand;
        break;
      default:
        yourHand = [];
    }
    isYourTurn = playerIndex == gameState.turn;
  }
  
  const sendAction = async () => {
    console.log("Sending action!")
    const card = selectedHand;
    // Check to see which items in selectedTalon are still there
    for (var i = 0; i < selectedTalon.length; i++) {
      if (gameState.talon.indexOf(selectedTalon[i]) === -1) {
        selectedTalon.splice(i, 1);
        i--;
      }
    }
    const actiontype = selectedTalon.length == 0 ? "play" : "capture";
    if (!selectedHand) {
      setDialog("Select a card to play first!");
    }
    if (!verifyCap(selectedTalon.map(crd => (new Card(crd)).value()), (new Card(selectedHand)).value())) {
      setDialog("Invalid Card Combination!")
      selectTalon(Array(0))
      return;
    }
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
      selectHand(null)
      selectTalon(Array(0))
      if (response.status !== 200) {
        setDialog(await response.text());
      }
      else setDialog(null);
    }).catch((err)=>{
      console.log("Problem with sending Data to home servers: " + String(err))
      setDialog("An unexpected error occurred while sending.")
    });
  };

  const requestUpdate = async () => {
    console.log("Sending update!")
    if (playerIndex == gameState.turn) {
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
        selectHand(null)
        selectTalon(Array(0))
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

  const handleTurnAnimation = () => {
  };

  useEffect(()=> {
    console.log("TURN UPDATE - " + String(gameState && gameState.turn));
    if (gameState && gameState.started) {
      setTime("--");
      setSpeed(100);
    }
    else {
      setSpeed(null);
    }
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

  // useEffect for handling complex animations. Set animations by using setAnimation. Animations can't be stopped once started.
  useEffect(() => {
    if (cAnimation == null) return;
    setAnimationCount(animationCount+1);
    let start = performance.now();
    const obj = cAnimation;
    requestAnimationFrame(function animate(time) {
      // timeFraction goes from 0 to 1
      let timeFraction = (time - start) / obj.duration;
      if (timeFraction > 1) timeFraction = 1;

      obj.draw(timeFraction); // draw it

      if (timeFraction < 1) {
        requestAnimationFrame(animate);
        return;
      }
      setAnimationCount(animationCount - 1);
    });
  }, [cAnimation]);

  if (!auth.currentUser) {
    return (<React.Fragment>
      An unexpected error occurred - GAME component.
    </React.Fragment>)
  }
  if (gameState) {
    return (
      gameState.started ? (
        <React.Fragment>
          <Dialog gd={dialogMessage} sd={setDialog} />
          <Hand data={yourHand} selectHand={selectHand} selectedHand={selectedHand}/>
          <button className="pushaction" onClick={()=>sendAction()}>{ selectedTalon.length === 0 ? "Play" : "Capture"}</button>

          <div className="north player" pid={String(playerIndex+1)%2}>
            <b>{gameState.playernames[(playerIndex+1)%2]}</b>
            <div className="pointcounter">
              {gameState.points[(playerIndex+1)%2]} PTS
            </div>
            <div className="cardcount">
              {playerIndex == 0 ? gameState.p2hand.length : gameState.p1hand.length}
              <img src={cardcount} height="15" className="cardDisplay" />
            </div>
          </div>

          <div className="south player" pid={String(playerIndex)}>
            <b>{gameState.playernames[playerIndex]}</b>
            <div className="pointcounter">
              {gameState.points[playerIndex]} PTS
            </div>
            <div className="cardcount">
              {playerIndex == 0 ? gameState.p1hand.length : gameState.p2hand.length}
              <img src={cardcount} height="15" className="cardDisplay" />
            </div>
          </div>

          <Talon className="talon" data={gameState.talon} selectTalon={selectTalon} selectedTalon={selectedTalon} />
          
          <div className={"turnindicator" + (isYourTurn ? " current" : "")} >
            {isYourTurn ? "Your" : gameState.playernames[gameState.turn] + "'s"} turn
          </div>
          
          <div className={"turntimer" + (isYourTurn ? " current" : "")}>
            {time}
          </div>

        </React.Fragment>
      ) : <RoomStart gameID={props.gameID} setGame={props.setGame}/>
    );
  } else if (!error) { return (
      <React.Fragment>
        <div style={{transform: "translateY(50vh)"}}>LOADING...</div>
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

  const login = async (e) => {
    e.preventDefault();
    auth.signInAnonymously();
    auth.onAuthStateChanged(user => {
      console.log("Auth state changed.")
      if (user) {
        user.updateProfile({
          displayName: formValue
        })
        console.log("Display name set.")
      }
    })
  }
  return (
    <React.Fragment>
      <form onSubmit={login}>
        <input value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder="Display Name" />
        <button type="submit" disabled={!formValue}>Login</button>
      </form>
    </React.Fragment>
  )
}

function RoomSelect(props) {
  const roomlist = firestore.collection('rooms');
  const [rooms] = useCollection(roomlist);
  const [user] = useAuthState(auth);
  const [dialog, setDialog] = useState(null)
  
  const joinRoom = async (rm) => {
    console.log(`Logging in to room '${rm}'`)
    const game = roomlist.doc(rm);
    const go = await game.get();
    const gamedata = go.data();
    if (user && gamedata) {
      if (gamedata["playercount"] >= 2 && gamedata["players"].indexOf(user.uid) == -1) {
        setDialog("Max players reached!")
      } else if (gamedata["players"].indexOf(user.uid) == -1) {
        game.set({
          players: gamedata["players"].concat([user.uid]),
          playernames: gamedata["playernames"].concat([user.displayName]),
          playercount: gamedata["playercount"] + 1
        }, {
          merge: true
        });
        props.setGame(rm);
      } else props.setGame(rm);
      
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
      roomname: user.displayName + "'s Room",
      started: false,
      talon: [],
      turn: 0,
      winner: "",
      password: "",
      roomcreator: user.displayName,
      date: null
    }).then(async (docRef) => {
      await joinRoom(docRef.id);
    });
  };

  if (!rooms) {
    return (<React.Fragment>
      An unexpected error occurred - ROOMSELECT component.
    </React.Fragment>)
  }
  var rmav = (!rooms.empty) ? (rooms.docs).map(rm => rm.id == "userfield" ? null : (<RoomOption key={rm.id} join={async() => joinRoom(rm.id)} rm={rm} />)) : (<div style={{
    fontSize: "15px",
    fontStyle: "italic",
    margin: "10px"
  }}>There are currently no available rooms. Create one yourself, or check back later.</div>);
  return (
    <React.Fragment>
      <GamehostStatus />
      <h1>
        Welcome, {user ? user.displayName : "Anonymous"}!
      </h1>
      <h2>Available Rooms...</h2>
      <Dialog gd={dialog} sd={setDialog} />
      {rmav}
      <button onClick={()=>auth.signOut()}>Sign Out</button>
      <button onClick={createGame}>Create New Game</button>

    </React.Fragment>)
}

function RoomStart(props) {
  const game = firestore.collection('rooms').doc(props.gameID);
  const [ dialogMessage, setDialog ] = useState("");
  const [ gameState, loading, error ] = useDocumentData(game);

  const startGame = () => {
    if (gameState.playercount != 2) {
      setDialog("Players must be equal to 2!");
      return;
    }
    const deck = new Deck();
    deck.Shuffle();
    const talon = deck.DealCard(4);
    var p1hand = deck.DealCard(3);
    var p2hand = deck.DealCard(3);
    p1hand = p1hand.concat(deck.DealCard(3));
    p2hand = p2hand.concat(deck.DealCard(3));
    game.set({
      deck: deck.deck.map(crd => crd.toString()),
      talon: talon.map(crd => crd.toString()),
      p1hand: p1hand.map(crd => crd.toString()),
      p2hand: p2hand.map(crd => crd.toString()),
      points: [0,0,0,0],
      started: true,
      turn: 0,
      lastPlay: "game start",
      date: firebase.firestore.Timestamp.now()
    }, {
      merge: true
    });
  }

  const leaveGame = () => {
    let players = gameState.players.slice();
    let playernames = gameState.playernames.slice();
    let playercount = gameState.playercount;
    players.splice(players.indexOf(auth.currentUser.uid),1);
    playernames.splice(playernames.indexOf(auth.currentUser.displayName),1);
    playercount --;

    game.set({
      players: players,
      playernames: playernames,
      playercount: playercount
    }, {
      merge: true
    });
    if (playercount === 0) game.delete().then(()=>props.setGame(null))
    else props.setGame(null)
  }

  if (gameState && !loading && !error) {
    return (
      <React.Fragment>
        <GamehostStatus/>
        <h1> { gameState.roomname } </h1>
        { gameState.winner && 
          <h2> 
            <span style={{fontWeight: "normal"}}>Winner: </span>
              {gameState.winner}
            <span style={{fontWeight: "normal"}}> with </span>
             {Math.max.apply(Math, gameState.points)}
            <span style={{fontWeight: "normal"}}> points!</span>
          </h2>
        }
        <div style={{fontWeight: "bold", margin: "10px"}}>Players:</div>
        {gameState.playernames.map(name => (
          <div key={name} className="rbwrapper" style={{
            backgroundColor: "white"
          }}>{name}</div>
        ))}

        <button onClick={startGame}>Start Game</button>
        <button onClick={leaveGame}>Leave Game</button>
        <div> {dialogMessage} </div>
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
  const nojoin = (data["started"] || data["playercount"] >= 2) && data["players"].indexOf(auth.currentUser.uid) === -1;
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
            <div style={{flexGrow: "1"}}><b>{data["playercount"]}</b>/2 Players</div>
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
  return (
    <div className="App">
      {
        user ? (gameID ? <Game gameID={gameID} setGame={setGame}/> : <RoomSelect setGame={setGame} />) : <Login />
      }
    </div>
  );
}

export default App;

