import './App.css';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import React, { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, firestore, opacityIn, opacityOut } from './cfg.js';
import { text, setLocale, currentLocale, locales } from 'util/locales.js';
import { motion, AnimatePresence } from "framer-motion";

import NetworkGame from './components/netgame.js';
import RoomSelect from './components/roomselection.js';
import Login from './components/login.js';

function App() {
  const [user] = useAuthState(auth);
  const [gameID, setGame] = useState(null);
  const [username, setUsername] = useState("Anonymous");

  var content;
  if (user) {
    if (gameID) {
      content = (
        <motion.div key="game" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
          <NetworkGame 
            gameID={gameID} 
            setGame={setGame} 
            auth={auth} 
            firestore={firestore}
          />
        </motion.div>
      );
    } else {
      content = (
        <motion.div key="roomselection" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
          <RoomSelect username={username} setGame={setGame} setName={setUsername} />
        </motion.div>
      );
    }
  }
  else {
    content = (
      <motion.div key="login" initial={opacityOut} animate={opacityIn} exit={opacityOut}>
        <Login setter={setUsername}/>
      </motion.div>
    );
  }
  return (
    <div className="App">
      <AnimatePresence exitBeforeEnter>
        { content }
      </AnimatePresence>
    </div>
  );
}

export default App;

