
const { initializeApp, auth, firestore } = require('firebase/app')
const fstore = require('firebase/firestore');
const fauth = require('firebase/auth');


const firebaseConfig = {
  apiKey: "AIzaSyBbeR5Y3qxAc51tsxF_dlcdgmXXM-NVT0g",
  authDomain: "tablicweb.firebaseapp.com",
  projectId: "tablicweb",
  storageBucket: "tablicweb.appspot.com",
  messagingSenderId: "1002328769656",
  appId: "1:1002328769656:web:e4ab64b2a9bda89795d98d"
};

// Initialize Firebase
initializeApp(firebaseConfig);
const express = require('express');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger')();

const app = express();

console.log(typeof(firestore))
app.use(bodyParser.urlencoded({ extended: false }));
app.use(pino);


app.get('/gamehost', async (request, result) => {
	const gameID = request.query.gameid;
	const userID = request.query.userid;
	const gameSnap = await 
	next();
});

app.post('/gamehost', (request, result) => {

	next();
});

app.listen(3001, () => {
	console.log("Listening on port 3001!");
});