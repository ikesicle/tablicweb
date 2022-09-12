import cardimgs from 'util/cards.js';
import { Card } from 'util/tablic.js';

function CardDisplay(props) {
  let cstyle = props.cstyle;
  if (!cstyle.bottom) cstyle.bottom = props.selected ? "10%" : "5%";
  return (
    <div className={"crdcontainer" + (props.selected ? " selectborder" : "")} style={cstyle} value={props.type} onClick={()=>{
      props.onClick(props.type);
    }}>
      <img src={cardimgs[props.type]} alt={Card.parse(props.type)} className="card" />
    </div>
  )
}

export default CardDisplay;