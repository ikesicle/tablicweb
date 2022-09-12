import { text } from 'util/locales.js';
import CardDisplay from './carddisplay.js';

function Talon(props) {
  var cnt = 1;
  return (
      <div className="talon-grid">
        <div className="sectionlabel">{text.UIText.Talon}</div>
        {props.data && props.data.map(
          crd => <CardDisplay key={crd} type={crd} selected={(props.selectedTalon.indexOf(crd) !== -1)} cstyle={{
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

export default Talon;