import React, { useState } from 'react';
import { text } from 'util/locales.js';

function CheatSheet(props) {
  const [ tab, setTab ] = useState(0);
  const [ navOpen, setNav ] = useState(false);
  const [ open, setOpen ] = useState(false);
  let data;
  switch (tab) {
    case 0: // Basic rules + controls
      data = (<>
        <ul>
          <li dangerouslySetInnerHTML={{__html: text.Guidebook.Rules1}}/>
          <li dangerouslySetInnerHTML={{__html: text.Guidebook.Rules2}}/>
          <li dangerouslySetInnerHTML={{__html: text.Guidebook.Rules3}}/>
          <li dangerouslySetInnerHTML={{__html: text.Guidebook.Rules4}}/>
        </ul>
      </>);
      break;
    case 1: // Card Values
      data = (<>
        <table className="pointtable">
          <tbody>
          <tr>
            <th style={{width: "50%"}}>Card Number/Letter</th>
            <th style={{width: "50%"}}>Value</th>
          </tr>
          <tr>
            <td>{text.Guidebook.SymbolNumbers}</td>
            <td>{text.Guidebook.ValueNumbers}</td>
          </tr>
          <tr>
            <td>{text.Guidebook.SymbolA}</td>
            <td dangerouslySetInnerHTML={{__html: text.Guidebook.ValueA}}/>
          </tr>
          <tr>
            <td>{text.Guidebook.SymbolJ}</td>
            <td>12</td>
          </tr>
          <tr>
            <td>{text.Guidebook.SymbolQ}</td>
            <td>13</td>
          </tr>
          <tr>
            <td>{text.Guidebook.SymbolK}</td>
            <td>14</td>
          </tr>
          </tbody>
        </table>
      </>);
      break;
    case 2: // Point Values
      data = (<>
        <table className="pointtable">
          <tbody>
          <tr>
            <th style={{width: "50%"}}>Card Type</th>
            <th style={{width: "50%"}}>Points yield</th>
          </tr>
          <tr>
            <td>10 ♦</td>
            <td>2</td>
          </tr>
          <tr>
              <td>2 ♣</td>
              <td>1</td>
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
      </>);
      break;
    default:
      data = "Invalid Entry";
      break;
  }
  return (<>
    <div className="cheatsheet">
      <div className="csnavsup">
        <button className="csopen" onClick={()=>{setNav(!navOpen); setOpen(false);}}>{text.Inputs.Guidebook}</button>
        <div className="csnavsub" style={ navOpen ? {} : {width: 0}}>
          <button onClick={()=>{setOpen(true);setTab(0);}}>{text.Inputs.RulesTab}</button>
          <button onClick={()=>{setOpen(true);setTab(1);}}>{text.Inputs.ValuesTab}</button>
          <button onClick={()=>{setOpen(true);setTab(2);}}>{text.Inputs.PointsTab}</button>
        </div>
      </div>
      <div className="cstabcontent" style={open ? {} : {height: 0, width: 0, opacity: 0}}>
        {data}
      </div>
    </div>
  </>)
}

export default CheatSheet;