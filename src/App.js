import logo from './logo.svg';
import './App.css';
import { verifyCap, Deck, Card, ranNum, faces, suits, NUMBER_OF_CARDS } from './tablic.js'
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useDocumentData, useCollectionData, useCollection } from 'react-firebase-hooks/firestore';
import { cards } from './cards.js';
import cardcount from './cardcount.png';
import firebaseConfig from './cfg.js';

// Initialize Firebase
const fbase = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth()
const firestore = firebase.firestore()

function Dialog(props) {
  return (
    <div className="dialog" style={props.gd ? {} : {display: "none"}}>
      {props.gd}
      <button className="closedialog" onClick={()=>props.sd(null)}>Ok</button>
    </div>
  );
}

function CardVis(props) {
  const [ selected, setSelect ] = useState(false)
  return (
    <div className={"crdcontainer" + (props.selected ? " selectborder" : "")} style={{
      left: String(props.handindex*10) + "%", 
      bottom: props.selected ? "20px" : "0px"
    }} onClick={()=>{
      console.log("Clicked " + props.type)
      props.onClick(props.type);
    }}>
      <img src={cards[props.type]} className="card" />
    </div>
  )
}

function Talon(props) {
  var cnt = 0;
  return (
      <div className="talon-grid">
        {props.data && props.data.map(
          crd => <CardVis key={cnt} type={crd} selected={(props.selectedTalon.indexOf(crd) !== -1)} handindex={cnt++} onClick={() => {var k = props.selectedTalon.slice();
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
  return (
    <div className="player-hand">
      {props.data && props.data.map( crd =>
        <CardVis key={cindex} type={crd} selected={(props.selectedHand === crd)} handindex={cindex++} onClick={props.selectHand} st={props.selectedHand}/>
      )}
    </div>
  )
}

function Game(props) {
  const game = firestore.collection('rooms').doc(props.gameID);
  const [ handHighlights, selectHand ] = useState(null);
  const [ talonHighlights, selectTalon ] = useState(Array(0));
  const [ dialogMessage, setDialog ] = useState(null);
  const [ gameState, loading, error ] = useDocumentData(game);
  
  var playerIndex, yourHand;

  if (gameState && !loading && !error) {
    playerIndex = gameState.players.indexOf(auth.currentUser.uid);
    switch (playerIndex) {
      case 0:
        yourHand = gameState.p1hand;
        break;
      case 1:
        yourHand = gameState.p2hand;
        break;
      default:
        yourHand = [];
    }
  }
  
  const sendAction = async () => {
    const card = handHighlights;
    // Check to see which items in talonHighlights are still there
    for (var i = 0; i < talonHighlights.length; i++) {
      if (gameState.talon.indexOf(talonHighlights[i]) === -1) {
        console.log(`${talonHighlights[i]} no longer in talon. Removing from query.`)
        talonHighlights.splice(i, 1);
        i--;
      }
    }
    const actiontype = talonHighlights.length == 0 ? "play" : "capture";
    if (!handHighlights) {
      setDialog("Select a card to play first!");
    }
    if (!verifyCap(talonHighlights.map(crd => (new Card(crd)).value()), (new Card(handHighlights)).value())) {
      console.log("Failed to verify.")
      setDialog("Invalid Card Combination!")
      selectTalon(Array(0))
      return;
    }
    console.log("Sending " + actiontype + "-type data")
    console.log("Sending data!")
    await fetch("/gamehost", {
      method: "POST",
      headers: {
        "userid": auth.currentUser.uid,
        "gameid": props.gameID,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        datatype: "turn",
        type: actiontype,
        card: card,
        captures: talonHighlights
      })
    }).then(async (response)=> {
      selectHand(null)
      selectTalon(Array(0))
      if (response.status !== 200) {
        setDialog(await response.text());
      }
      else setDialog(null);
    }).catch((err)=>{
      console.log("Error in retrieval.")
      setDialog("An unexpected error occurred while sending.")
    });
  };
  
  if (gameState && !loading && !error) {
    return (
      gameState.started ? (
        <React.Fragment>
        <Dialog gd={dialogMessage} sd={setDialog} />
        <Hand data={yourHand} selectHand={selectHand} selectedHand={handHighlights}/>
        <button className="pushaction" onClick={()=>sendAction()}>Play / Capture</button>

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

  return (
    <React.Fragment>
      <h1>
        Welcome, {user ? user.displayName : "Anonymous"}
      </h1>
      <Dialog gd={dialog} sd={setDialog} />
      <ul>
        { rooms && (rooms.docs).map(rm => <li key={rm.id} onClick={async () => await joinRoom(rm.id)}>Room {rm.id}</li>) }
      </ul>
      <button onClick={()=>auth.signOut()}>Sign Out</button>

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
    console.log(p1hand);
    console.log(p2hand);
    game.set({
      deck: deck.deck.map(crd => crd.toString()),
      talon: talon.map(crd => crd.toString()),
      p1hand: p1hand.map(crd => crd.toString()),
      p2hand: p2hand.map(crd => crd.toString()),
      points: [0,0,0,0],
      started: true,
      turn: 0,
      lastPlay: "game start",
    }, {
      merge: true
    });
  }
  if (gameState && !loading && !error) {
    return (
      <React.Fragment>
        <h1> { gameState.roomname } </h1>
        <h2> { gameState.winner && `Winner: ${gameState.winner} with ${Math.max.apply(Math, gameState.points)} points!`} </h2>
        <ul>
          {gameState.playernames.map(name => <li key={name}>{name}</li>)}
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
        user ? (gameID ? <Game gameID={gameID}/> : <RoomSelect setGame={setGame} />) : <Login />
      }
    </div>
  );
}

export default App;

