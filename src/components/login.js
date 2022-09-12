import twlogo from 'assets/logo.png';
import React, {useState} from 'react';
import firebase from 'firebase/compat/app';
import { auth, firestore } from 'cfg.js';
import { text } from 'util/locales.js';

import Dialog from './dialog.js';
import LanguageSelect from './langsel.js';
import GamehostStatus from './gamestatus.js';



function Login(props) {
  const [formValue, setFormValue] = useState('');
  const [dialog, setDialog] = useState(null);

  const login = async (e) => {
    e.preventDefault();
    const regex = /^[a-zA-Z0-9 _]+$/i;
    if (formValue.length > 15) {
      setDialog(text.Dialogs.NameTooLong);
      return;
    }
    if (!regex.test(formValue)) {
      setDialog(text.Dialogs.NameInvalidChars);
      return;
    }
    await auth.signInAnonymously().then(async (ucred) => {
      await ucred.user.updateProfile({displayName: formValue});
      var userdataref = await firestore.collection('userstates').doc(ucred.user.uid);
      if (!(await userdataref.get().exists)) {
        await userdataref.set({
          inGame: "",
          themePref: "",
          lastlogin: null
        });
      }
      await userdataref.set({
        lastlogin: firebase.firestore.Timestamp.now()
      }, {merge: true})
    });
    props.setter(formValue);
  }
  
  return (
    <React.Fragment>
      <Dialog gd={dialog} sd={setDialog} />
      <img src={twlogo} alt="Logo" className="applogo"></img>
      <form onSubmit={login}>
        <input value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder={text.Inputs.LoginPlaceholder} style={{
          height: "1.5em",
          margin: "1.5em",
          border: "1px solid black",
          padding: "3px"
        }} />
        <button type="submit" disabled={!formValue} style={{
          height: "2.1em",
          padding: "3px"
        }}>{text.Inputs.LoginBtn}</button>
      </form>

      <LanguageSelect postChange={setDialog}/>
      <GamehostStatus hidden={false} />
      <div className="credits">{text.MiscText.Credits}</div>
    </React.Fragment>
  )
}

export default Login;