import logo from './logo.svg';
import './App.css';
import { verifyCap, Deck, Card, ranNum, faces, suits, NUMBER_OF_CARDS } from './tablic.js'
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useDocumentData, useCollectionData } from 'react-firebase-hooks/firestore';
import { cards } from './cards.js';
import cardcount from './cardcount.png';

const firebaseConfig = {
  apiKey: "AIzaSyBbeR5Y3qxAc51tsxF_dlcdgmXXM-NVT0g",
  authDomain: "tablicweb.firebaseapp.com",
  projectId: "tablicweb",
  storageBucket: "tablicweb.appspot.com",
  messagingSenderId: "1002328769656",
  appId: "1:1002328769656:web:e4ab64b2a9bda89795d98d"
};


// Initialize Firebase
const fbase = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth()
const firestore = firebase.firestore()

function CardVis(props) {
  const [ selected, setSelect ] = useState(false)
  return (
    <img src={cards[props.type]} style={{position: "absolute", left: String(props.handindex*15) + "px", bottom: props.selectedHand == props.type ? "40px" : "0px"}} onClick={()=>{
      props.onClick(props.type);
    }} />
  )
}

function Talon(props) {
  return (
      <div className="talonGrid">
        {props.data && props.data.map(
          crd => <CardVis type={crd} handindex={0} onClick={(tile) => {var k = props.selectedHand;
            if (k.indexOf(crd) == -1) {k.push(crd);}
            else {k.splice(k.indexOf(crd), 1);}
            props.selectedTalon(k);
          }} />
        )}
      </div>
    )
}

function Hand(props) {
  var ret = [], cindex = 0;
  if (props.hand) {
    props.hand.forEach(crd=>{
      ret.push(
        <CardVis type={crd} handindex={cindex++} onClick={props.selectHand} st={props.selectedHand}/>
      )
    });
  }
  return (
    <div className="player hand">
      {ret}
    </div>
  )
}

function Game(props) {
  const game = firestore.collection('rooms').doc(props.gameID);
  const [ handHighlights, selectHand ] = useState(null);
  const [ talonHighlights, selectTalon ] = useState(Array(0));
  const [ dialogMessage, setDialog ] = useState("");
  const [ gameState, loading, error ] = useDocumentData(game);
  console.log(`Error Value: ${error}`)
  console.log(`Loading Value: ${loading}`);
  console.log(`GameState Value: ${gameState}`);
  
  var playerIndex, yourHand, actiontype;


  const calculate = () => {
    playerIndex = gameState.players.indexOf(auth.currentUser.uid);
    switch (playerIndex) {
      case 0:
        yourHand = gameState.players.p1hand;
      case 1:
        yourHand = gameState.player.p2hand;
      default:
        yourHand = [];
    }
    actiontype = selectTalon == 0 ? "play" : "capture";
  }
  if (gameState && !loading && !error) calculate()
  const sendAction = async () => {
    const card = handHighlights;
    if (!verifyCap(handHighlights, talonHighlights)) {
      return;
    }
    const rawresponse = await fetch(window.location.host + "/gamehost", {
      method: "POST",
      headers: {
        "userid": auth.currentUser.uid,
        "gameid": props.gameID,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: actiontype,
        card: card,
        captures: talonHighlights
      })
    });
    setDialog(rawresponse.body);
  };
  if (gameState && !loading && !error) {
    return (
       gameState.started ? (
        <React.Fragment>
        <Hand data={yourHand} selectHand={selectHand} selectedHand={handHighlights}/>
        <button className="pushAction" onClick={()=>sendAction()}></button>
        <div className="north player" pid={String(playerIndex+1)}>
          {gameState.playernames}
          <div className="pointcounter">
            {gameState.points[(playerIndex+1)%2]}
          </div>
          <div className="cardcount">
            {playerIndex == 0 ? gameState.p2hand.length : gameState.p1hand.length}
            <img src={cardcount} className="cardDisplay" />
          </div>
        </div>
        <Talon className="talon" data={gameState.talon} selectTalon={selectTalon} selectedTalon={talonHighlights} />
        <div className="turnIndicator">
        </div>
      </React.Fragment>
    ) : (
      <RoomStart gameID={props.gameID}/>
    )
  );
  } else {
    return (
      <React.Fragment>
        <div>An unexpected error occurred while loading.</div>
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
  const game = firestore.collection('rooms').doc(props.gameID);
  const roomlist = firestore.collection('rooms');
  const query = roomlist.orderBy('createdAt').limit(25);
  const [rooms] = useCollectionData(query);
  const [user] = useAuthState(auth);
  const [dialog, setDialog] = useState("")
  
  const joinRoom = async (rm) => {

    console.log("Logging in")
    const go = await game.get();
    const gamedata = go.data();
    console.log(go.data());
    if (user && gamedata) {
      if (gamedata["playercount"] == 2 && !(user.uid in gamedata["players"])) {
        setDialog("Max players reached!")
      }
      if (!(user.uid in gamedata)) {
        game.set({
          players: gamedata["players"] + [user.uid],
          plist: gamedata["playernames"] + [user.displayName],
          playercount: gamedata["playercount"] + 1
        });
      }
      props.setGame(rm);
    }
    else if (!(gamedata)) {
      setDialog("Unable to join.");
    }
  };

  return (
    <React.Fragment>
      <h1>
        Welcome, {user ? user.displayName : "Anonymous"}
      </h1>
      <div> {dialog} </div>
      <ul>
        <li onClick={async () => await joinRoom('sample-game')}>Join room 'Sample-Room' by clicking on this text</li>
      </ul>
      <button onClick={()=>auth.signOut()}>Sign Out</button>

    </React.Fragment>)
}

function RoomStart(props) {
  const game = firestore.collection('rooms').doc(props.gameID);
  const [ dialogMessage, setDialog ] = useState("");
  const [ gameState, loading, error ] = useDocumentData(game);

  const startGame = () => {
    if (gameState.playercount < 2) {
      setDialog("Not enough players!");
      return;
    }
    const deck = new Deck();
    deck.Shuffle();
    const talon = deck.DealCard(4);
    const p1hand = deck.dealCard(3);
    const p2hand = deck.dealCard(3);
    p1hand.concat(deck.dealCard(3));
    p2hand.concat(deck.dealCard(3));
    game.set({
      deck: deck.deck,
      talon: talon,
      p1hand: p1hand,
      p2hand: p2hand,
      points: [0,0,0,0],
      started: true,
      turn: 1
    });
  }
  if (gameState && !loading && !error) {
    return (
      <React.Fragment>
        <h1> { gameState.roomName } </h1>
        <ul>
          {gameState.playernames.map(name => <li>{name}</li>)}
        </ul>
        <button onClick={startGame}>Start Game</button>
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

function App() {
  const [user] = useAuthState(auth);
  const [gameID, setGame] = useState(null);
  return (
    <div className="App">
      {
        user ? (gameID ? <Game gameID={gameID}/> : <RoomSelect setGame={setGame}/>) : <Login />
      }
    </div>
  );
}

export default App;

