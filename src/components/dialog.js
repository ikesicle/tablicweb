import { text } from 'util/locales.js';

function Dialog(props) {
  return (
    <div className="dialog" style={props.gd ? {opacity: "1"} : {top: "-40vh", opacity: "0"}}>
      <div style={{flexGrow: "10"}}> {props.gd} </div>
      <button className="closedialog" onClick={()=>props.sd(null)}>{text.Inputs.OkButton}</button>
    </div>
  );
}

export default Dialog;