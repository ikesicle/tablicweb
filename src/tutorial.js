import React, { useState, useEffect } from 'react';
import { evaluatePoints } from './tablic.js';
import { GameRenderer } from './renderer.js';

function TutorialDialog(props) {
  var style = {zIndex: 9};
  if ("xp" in props) {
    style.left = props.xp;
    style.right = "auto";
  }
  if ("yp" in props) {
    style.top = props.yp;
    style.bottom = "auto";
  }
  if ("w" in props) {
    style.width = props.w;
  }
  if ("h" in props) {
    style.height = props.h;
  }
  return (
    <div className="dialog" style={style}>
      <div style={{flexGrow: "10"}}> {props.message} </div>
      { !("nextEnabled" in props) || props.nextEnabled ? (<button className="closedialog" onClick={props.onclose}>Next</button>) : null }
    </div>
  );
}

function TutorialOverlay(props) {

  var overlay;
  switch (props.eventID) {
    case 0:
      overlay = (<React.Fragment>
        <TutorialDialog message="Welcome to TablicWeb! This tutorial will show you how to play this simple, yet addicting multiplayer game."
          onclose={() => {
            props.setEvent(1);
          }}
          xp="9vw"
          yp="30vh"
          w="80vw"
          h="20vh"
         />
         <div className="screencover" style={{backgroundColor: "rgba(0,0,0,0.5)"}} key="selector"></div>
      </React.Fragment>);
      break;

    case 1:
      overlay = (<React.Fragment>
        <TutorialDialog message="Your objective is to score more points than your opponent. You gain points through capturing cards of high value."
          onclose={() => {
            props.setEvent(2);
          }}
          xp="19vw"
          w="60vw"
         />
        <div className="selectborder player south" key="selector"> </div>
        <div className="screencover" key="cover"></div>
      </React.Fragment>);
      break;

    case 2:
      overlay = (<React.Fragment>
        <TutorialDialog message="Every turn, you can choose to play a card from your hand into the talon (centre of the board) or use a card from your hand to capture cards in the talon."
          onclose={() => {
            props.setEvent(3);
          }}
          xp="9vw"
          yp="10vh"
          w="80vw"
          h="30vh"
         />
        <div className="screencover" key="cover"></div>
      </React.Fragment>);
      break;

    case 3:
      overlay = (<React.Fragment>
        <TutorialDialog message={(<>
          To play a card, <b>click</b> on it to <b>select</b> it, and then press the <b>Play</b> button.
          </>
          )}
          onclose={() => {
            props.setEvent(4);
          }}
          nextEnabled={props.readyNext}
          xp="50vw"
          yp="5vh"
          w="40vw"
          h="20vh"
         />
      </React.Fragment>);
      break;
    
    case 4:
      overlay = (<React.Fragment>
        <TutorialDialog message={(<>
          You can also use cards from your hand to 'capture' cards from the talon. You can capture cards of a certain <b>value</b> with a card of equal value.
        </>)}
          onclose={() => {
            props.setEvent(4.5);
          }}
          xp="9vw"
          yp="5vw"
          w="80vw"
          h="20vh"
         />
        <div className="screencover" key="cover"></div>
      </React.Fragment>);
      break;

    case 4.5:
      overlay = (<React.Fragment>
        <TutorialDialog message={(<>
          <p>Cards generally have values as written on the card, with special cases for letter cards.</p>
          <table className="pointtable">
          	<tbody>
            <tr>
              <th style={{width: "50%"}}>Card Number/Letter</th>
              <th style={{width: "50%"}}>Value</th>
            </tr>
            <tr>
              <td>Numbers</td>
              <td>As Written</td>
            </tr>
            <tr>
              <td>Aces (A)</td>
              <td><b>Variable</b>; can be 1 or 11</td>
            </tr>
            <tr>
              <td>Jacks (J)</td>
              <td>12</td>
            </tr>
            <tr>
              <td>Queens (Q)</td>
              <td>13</td>
            </tr>
            <tr>
              <td>Kings (K)</td>
              <td>14</td>
            </tr>
            </tbody>
          </table>
          </>)}
          onclose={() => {
            props.setEvent(5);
          }}
          xp="9vw"
          yp="5vw"
          w="80vw"
          h="60vh"
        />
        <div className="screencover" key="cover"></div>
      </React.Fragment>);
      break;

    case 5:
      overlay = (<React.Fragment>
        <TutorialDialog message={(<>
        To capture a card, select the card you wish to capture from the talon, and select the card you are capturing with from your hand.<p>Remember, you can capture cards with cards of equal value.</p>
        </>)}
          onclose={() => {
            props.setEvent(6);
          }}
          nextEnabled={props.readyNext}
          xp="29vw"
          yp="5vh"
          w="60vw"
          h="20vh"
        />
      </React.Fragment>);
      break;

    case 6:
      overlay = (<React.Fragment>
        <TutorialDialog message="Great work! You may have noticed that you now have 3 points."
          onclose={() => {
            props.setEvent(7);
          }}
          nextEnabled={true}
          xp="29vw"
          yp="5vh"
          w="60vw"
          h="20vh"
        />
        <div className="selectborder player south" key="selector"> </div>
        <div className="screencover" key="cover"></div>
      </React.Fragment>);
      break;

    case 7:
      overlay = (<React.Fragment>
        <TutorialDialog message={<>
          <p>
            You gain points in Tablic for cards which you <b>capture</b> or cards that you <b>capture with</b>. How many points you get is determined by the card.</p>
          </>
          }
          onclose={() => {
            props.setEvent(7.5);
          }}
          nextEnabled={true}
          xp="14vw"
          yp="35vh"
          w="70vw"
          h="30vh"
        />
        <div className="screencover" key="cover"></div>
      </React.Fragment>);
      break;

    case 7.5:
      overlay = (<React.Fragment>
        <TutorialDialog message={<>
          <table className="pointtable">
          	<tbody>
            <tr>
              <th style={{width: "50%"}}>Card Type</th>
              <th style={{width: "50%"}}>Points yield</th>
            </tr>
            <tr>
              <td>2 ♣</td>
              <td>2</td>
            </tr>
            <tr>
              <td>10 ♦</td>
              <td>2</td>
            </tr>
            <tr>
              <td>Other Tens (10)</td>
              <td>1</td>
            </tr>
            <tr>
              <td>Jacks (J)</td>
              <td>1</td>
            </tr>
            <tr>
              <td>Queens (Q)</td>
              <td>1</td>
            </tr>
            <tr>
              <td>Kings (K)</td>
              <td>1</td>
            </tr>
            <tr>
              <td>Aces (A)</td>
              <td>1</td>
            </tr>
            </tbody>
          </table>
          <p>
            So, since you just captured a <b>10 ♣</b> with a <b>10 ♦</b>, you gained <b>1</b> point for the <b>10 ♣</b> and <b>2</b> points for the <b>10 ♦</b>, resulting in a total of <b>3</b> points.
          </p>
          </>
          }
          onclose={() => {
            props.setEvent(8);
          }}
          nextEnabled={true}
          xp="9vw"
          yp="5vh"
          w="80vw"
          h="60vh"
        />
        <div className="screencover" key="cover"></div>
      </React.Fragment>);
      break;
    
    case 8:
      overlay = (<React.Fragment>
        <TutorialDialog message={(<>You can also capture <b>combinations</b> of cards, as long as their values add up to your capturing card's value.</>)}
          onclose={() => {
            props.setEvent(9);
          }}
          nextEnabled={props.readyNext}
          xp="29vw"
          yp="5vh"
          w="60vw"
          h="20vh"
         />
      </React.Fragment>);
      break;

    case 9:
      overlay = (<React.Fragment>
        <TutorialDialog message={"Additionally, you can capture multiple times in a single round. Just select all the cards you wish to capture, and the game will automatically verify the capture."}
          onclose={() => {
            props.setEvent(10);
          }}
          nextEnabled={props.readyNext}
          xp="9vw"
          yp="5vh"
          w="80vw"
          h="20vh"
         />
      </React.Fragment>);
      break;

    case 10:
      overlay = (<React.Fragment>
        <TutorialDialog message={(<>
            <p>Great job! You've now learnt all you need to know to play Tablic!</p>
            <p>Last few things which are good to know:</p>
            <ul>
              <li>When capturing, you gain 1 more point if you clear the entire board (an <b>All Clear</b>).</li>
              <li>At the end of the game, the player with the most captured cards gains an extra 3 points.</li>
              <li>The game continues until there are no more cards in the players' hands or the deck.</li>
            </ul>
            <p>That's all for now! Have fun on <b>TablicWeb</b>!</p>

          </>)}
          onclose={() => {
            props.setEvent(11);
          }}
          nextEnabled={true}
          xp="2vw"
          yp="4vh"
          w="90vw"
          h="70vh"
         />
      </React.Fragment>);
      break;

    default:
      overlay = null;
      break;
  }
  return overlay;
}

function Tutorial(props) {
  const user = props.user;
  const [getDialog, setDialog] = useState(null);

  const [ deck ] = useState([]);
  const [ lastPlay, setLastPlay ] = useState("");
  const [ p1hand, setHand ] = useState([]);
  const [ yourPoints, setPoints ] = useState(0);
  const [ captureCount, setCaptureCount ] = useState(0);
  const [ talon, setTalon ] = useState([]);
  const [ talonprev, setPrev ] = useState([]);
  const [ turn, setTurn ] = useState(0);

  const [ nextEnabled, setNextEnabled ] = useState(true);
  
  const [ onPlayFunction, setOnPlay ] = useState(()=> () => {});

  const tutorialGame = {
    deck: deck,
    lastPlay: lastPlay,
    p1hand: p1hand,
    p2hand: [],
    playercount: 2,
    playernames: [user.displayName, "Adam"],
    players: [user.uid, "Tutorial"],
    points: [yourPoints, 0, 0, 0],
    capturecount: [captureCount, 0, 0, 0],
    roomname: "Tutorial",
    started: true,
    talon: talon,
    talonprev: talonprev,
    turn: turn,
    gamemode: "FFA",
    teamdist: [0,0,0,0],
    turnorder: [0, 1]
  };

  const [ eventID, setEventID ] = useState(0);

  useEffect(()=>{
    switch (eventID) {
      case 2:
        setHand(["1A", "22", "33", "44", "15"]);
        break;
      case 3:
        setNextEnabled(false);
        setOnPlay(() => (a, h, t) => {
          if (a === "play") {
            setHand(p1hand.filter((val)=>val !== h));
            setTalon([h]);
            setNextEnabled(true);
            setTurn(1);
            setOnPlay(() => () => {setDialog("Not your turn!")});
            setLastPlay(a +' '+h+' '+t.join(' '));
          } else {
            setDialog("Play a card!");
          }
        });
        break;
      case 5: 
        setNextEnabled(false);
        setTurn(0);
        setHand(["40", "32", "24"]);
        setTalon(["10", "15", "47"]);
        setOnPlay(() => (a, h, t) => {
          if (a === "capture") {
            setHand(["32", "24"]);
            setTalon(["15", "17"]);
            setPrev(["10", "15", "47"]);
            setTurn(1);
            setOnPlay(() => () => {setDialog("Not your turn!")});
            setPoints(yourPoints + evaluatePoints(t.concat([h])));
            setCaptureCount(2);
            setNextEnabled(true);
            setLastPlay(a +' '+h+' '+t.join(' '));
          }
          else {
            setDialog("Try capturing a card with another card!");
          }
        })
        break;
      case 8:
        setNextEnabled(false);
        setTurn(0);
        setHand(["30"]);
        setTalon(["22", "33", "15", "44"]);
        setOnPlay(() => (a, h, t) => {
          if (a === "capture") {
            setHand([]);
            setTalon(["44"]);
            setPrev(["22", "33", "15", "44"]);
            setTurn(1);
            setCaptureCount(6)
            setOnPlay(() => () => {setDialog("Not your turn!")});
            setPoints(yourPoints + evaluatePoints(t.concat([h])));
            setNextEnabled(true);
            setLastPlay(a +' '+h+' '+t.join(' '));
          }
          else {
            setDialog("Try capturing some cards!");
          }
        })
        break;
      case 9:
        setNextEnabled(false);
        setTurn(0);
        setHand(["1K"]);
        setTalon(["12", "24", "25", "33", "4K", "1J", "32"]);
        setOnPlay(() => (a, h, t) => {
          if (a === "capture") {
            if (t.length === 7) {
              setHand([]);
              setTalon([]);
              setPrev(["12", "24", "25", "33", "4K", "1J", "32"]);
              setTurn(1);
              setCaptureCount(14);
              setOnPlay(() => () => {setDialog("Not your turn!")});
              setPoints(10);
              setNextEnabled(true);
              setLastPlay(a +' '+h+' '+t.join(' '));
            } else {
              setDialog("Capture all combinations/cards which have a value of 14 at once!")
            }
          }
          else {
            setDialog("Try capturing some cards!");
          }
        })
        break;
      case 11:
        props.exit();
        break;
      default:
        break;
    }
  // eslint-disable-next-line
  }, [eventID]);
  
  return (<React.Fragment>
    <button className="exitbutton" onClick={props.exit}>Exit</button>
    <TutorialOverlay eventID={eventID} setEvent={setEventID} readyNext={nextEnabled}/>

    <GameRenderer gameState={tutorialGame} spectating={false} onPlay={onPlayFunction} playerID={0} time="∞" getDialog={getDialog} setDialog={setDialog}/>
  </React.Fragment>)
};

export default Tutorial;
