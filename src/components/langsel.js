import React from 'react';
import { locales, currentLocale, setLocale, text } from 'util/locales.js';

function LanguageSelect(props) {
  var langoptions = [];
  Object.getOwnPropertyNames(locales).forEach(lang=>{
    langoptions.push(<option key={lang} value={lang} defaultValue={currentLocale === lang}>{lang}</option>)
  });
  return (<React.Fragment>
    <select name="lang" id="lang" className="langselectbar" onChange={(e)=>{
        setLocale(e.target.value);
        props.postChange(text.Dialogs.OnLangChange || "Language successfully changed!");
    }}>
      { langoptions }
    </select>
  </React.Fragment>);
}

export default LanguageSelect;