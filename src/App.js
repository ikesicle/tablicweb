import logo from './logo.svg';
import './App.css';
import { verifyCap, Deck, Card, ranNum, faces, suits, NUMBER_OF_CARDS } from './tablic.js'
import { firebase, initializeApp } from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import React, { useState, useEffect } from 'react';

const firebaseConfig = {
  apiKey: "AIzaSyCJ4oyGd5pps6qiT00ivCNlLyrNPFQlncc",
  authDomain: "tact-ab580.firebaseapp.com",
  projectId: "tact-ab580",
  storageBucket: "tact-ab580.appspot.com",
  messagingSenderId: "814284452594",
  appId: "1:814284452594:web:7d9c7ce961c0bd4000166b"
};

// Initialize Firebase
const fbase = initializeApp(firebaseConfig);

function CardVis(props) {
  return (
    <span></span>
  )
}
function Hand(props) {
  var ret = [], cindex = 0;
  if (props.hand) {
    props.hand.forEach(crd=>{
      ret.push(
        <CardVis type={crd} handindex={cindex++} handtotal={props.hand.length} />
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
  /*
    this.state = {
      gameid: this.props.gameid,
      playercards: Array(6).fill(null),
      enemies: Array(3).fill(null),
      turn: null // 0, 1, 2, 3 for player and up to 3 enemies.
    }

    The game's only hook is the websocket for listening for updates.
    Updates are sent via Onclick events for 
  */
  const [gameID, setGame] = useState(props.gameid);
  const [playerCards, setPlayer] = useState(Array(6).fill(null));
  const [enemyCards, setEnemy] = useState(Array(3).fill(0));
  const [talon, setTalon] = useState(Array(4).fill(null));
  const [turn, setTurn] = useState(null);
  const []

  const sendCardPlace = (ctype) => {

  };


  return (
    <React.Fragment>
      <Hand data={""}/>
    </React.Fragment>
  );
}

function App() {

  const [gameID, setGame] = useState(null);
  return (
    <div className="App">
      {
        gameID && <Game gameID={gameID}/>
      }
    </div>
  );
}

export default { App };
