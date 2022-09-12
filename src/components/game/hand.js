import { text } from 'util/locales.js';
import CardDisplay from './carddisplay.js';

function Hand(props) {
  let cindex = 0;
  let startingoffset = 37.5-2.5*(props.data.length-1);
  return (
    <div className="player-hand">
      <div className="sectionlabel">{text.UIText.Hand}</div>
      {props.data && props.data.map( crd =>
        <CardDisplay key={cindex} type={crd} selected={(props.selectedHand === crd)} 
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

export default Hand;