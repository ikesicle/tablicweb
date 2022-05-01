const faces = [ "Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King" ];
const suits = [ "Hearts", "Clubs", "Diamonds", "Spades" ];
const NUMBER_OF_CARDS = 52;
const faceabbrs = [ "A", "2", "3", "4", "5", "6", "7", "8", "9", "0", "J", "Q", "K" ];

function verifyCap(crds, capval) {
  if (Math.max(crds) > capval) {
    return false;
  }
  var k;
  var final = false;
  // TODO: Currently does not account for aces possibly having a value of 11
  var crdsclone = crds.slice();
  var initcheck = true;
  var pass;
  crdsclone.sort((a, b) => a - b);
  while (crdsclone.indexOf(1) !== -1 || initcheck) {
    pass = true;
    let i = crdsclone.indexOf(1);
    if (i !== -1 && !initcheck) {
      crdsclone[i] = 11;
    }
    initcheck = false;
    crds = crdsclone.slice();

  while (crds.length > 0) {
      k = findCombo(crds.slice(), capval);
      if (!k) {pass = false; break}
      k.forEach(value => {
        crds.splice(crds.indexOf(value),1);
      });
  }
    if (pass) return true;
  }
  return false;
}

function findCombo(arr, target) {
  if (target === 0) return [];
  var k = sumsPossible(arr, target)
  arr.sort((a, b) => a - b);
  arr.reverse();
  if (arr[0] === target) {
    return [arr[0]];
  }
  else if (k[0] === target) {
    for (var i = 0; i < arr.length; i++) {
      // Find largest possible combination
      let nw = arr.slice(0,i).concat(arr.slice(i+1, arr.length));
      if (sumsPossible(nw, target-arr[i])[0] === target-arr[i]) {
        return [arr[i]].concat(findCombo(nw, target-arr[i]));
      }
    }
  }
  return false;
}

function sumsPossible(arr, target) {
  arr.sort((a, b) => a - b);
  arr.reverse();
  var m = new Set([0]);
  var mn;
  for (var i = 0; i < arr.length; i++) {
    mn = new Set(m);
    mn.forEach((value) => {
      if (value + arr[i] <= target) {
        m.add(value+arr[i]);
      }
    });
  }
  return s2arr(m);
}

function s2arr(st) {
  var rt = []
  st.forEach((value) => {
    rt.push(value)
  });
  rt.sort((a, b) => a - b);
  rt.reverse();
  return rt;
}

function ranNum(low, high) { return low + Math.floor(Math.random()*(high-low)); }


class Deck {
  constructor() {
    this.deck = new Array(NUMBER_OF_CARDS);
    for (var count = 0; count < this.deck.length; count++) this.deck[count] = new Card(faceabbrs[count % 11]+suits[count / 13]);
  }

  Shuffle() {
    for (var first = 0; first < this.deck.length; first++)
    {
      var second = ranNum(0,NUMBER_OF_CARDS);
      var temp = this.deck[first];
      this.deck[first] = this.deck[second];
      this.deck[second] = temp;
    }
  }

  DealCard(count) {
    const ret = this.deck.slice(0,count);
    this.deck.splice(0,count);
    return ret;
  }
}

class Card {
  constructor(card) {
      this.face = card[1];
      this.suit = card[0];
  }
  toString() { return this.face + " of " + this.suit; }

  value() {
    let val = faceabbrs.index(this.face);
    return val + 1 + (val >= 10);
  }
}

export { verifyCap, Deck, Card, ranNum, faces, suits, NUMBER_OF_CARDS }