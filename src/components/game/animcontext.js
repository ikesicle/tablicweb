import React, { useState, useEffect } from 'react';
import anime from 'util/anime.es.js';

function GameAnimCtx(props) {
  const [ currentAnimation, setCurrentAnimation ] = useState([]);
  useEffect(() => {
    if (props.animation) {
      let tl = anime.timeline(props.animation[0]);
      for (let i = 1; i < props.animation.length; i++) 
        if (!("length" in props.animation[i])) tl.add(props.animation[i]);
        else tl.add(props.animation[i][0], props.animation[i][1]);

      setCurrentAnimation(tl);
      tl.restart();
    }
  }, [props.content]);
  return (<>
    <div className="animation">
      {props.content}
    </div>
  </>)
}

export default GameAnimCtx;