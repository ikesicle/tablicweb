import firebase_admin as firebase
import firebase_admin.firestore as firestore
from firebase_admin import credentials
import logging
from time import sleep
from flask import Flask, make_response, Response, jsonify, request, abort, render_template
import threading
import asyncio
from tablic import evaluatePoints

config = {
  "apiKey": "AIzaSyBbeR5Y3qxAc51tsxF_dlcdgmXXM-NVT0g",
  "authDomain": "tablicweb.firebaseapp.com",
  "projectId": "tablicweb",
  "storageBucket": "tablicweb.appspot.com",
  "messagingSenderId": "1002328769656",
  "appId": "1:1002328769656:web:e4ab64b2a9bda89795d98d"
};

cred = credentials.Certificate("tablicweb-firebase-adminsdk-90wfc-12e45345a3.json")
firebase.initialize_app(cred)

fstore = firestore.client()
rooms = fstore.collection("rooms")

app = Flask(__name__)

logging.basicConfig(
  filename="debug.log",
  filemode="w",
  level="DEBUG",
  format="[%(asctime)s.%(msecs)03d] %(levelname)s... %(message)s",
  datefmt='%H:%M:%S'
)

"""
wsl = logging.getLogger('websockets')
wsl.setLevel(logging.DEBUG)
wsl.addHandler(logging.StreamHandler())

logwkzg = logging.getLogger('werkzeug')
logwkzg.setLevel(logging.ERROR)
"""
@app.route("/gamehost", methods = ["POST"])
async def gamehost():
  def rejectRequest(code, msg):
    resp = make_response(msg)
    resp.status_code = code
    resp.headers["content-type"] = "text/plain"
    return resp

  okReq = make_response("OK")
  okReq.status_code = 200
  okReq.headers["content-type"] = "text/plain"
  
  if request.method == "POST":
    actiontype = request.headers["actiontype"]
    userid = request.headers["userid"]
    gameid = request.headers["gameid"]
    actiondata = request.json
    room = None
    try:
      room = fstore.document("rooms/" + gameid)
    except: return rejectRequest(404, "Room not found.")

    roomsnapshot = roomdata.get()
    if not roomsnapshot.exists: return rejectRequest(404, "Room no longer exists.")
    roomsnapshot = roomsnapshot.data

    def redistributeCards():
      hands = {
        "p1hand": [],
        "p2hand": [],
        "p3hand": [],
        "p4hand": [],
      }
      newdeck = roomsnapshot["deck"]
      for rpt in range(0,2):
        for playerhands in range(0, roomsnapshot.playercount):
          lcp = "p" + str(playerhands) + "hand"
          hands[lcp] += newdeck[:3]
          newdeck = newdeck[3:]
      hands["deck"] = newdeck
      room.set(hands, merge=True)

    if actiontype == "turn":
      cp = "p" + str(roomsnapshot["turn"]+1) + "hand"
      if roomsnapshot["players"][roomsnapshot["turn"]] != userid: return rejectRequest(403, "Not your turn!")
      if not roomsnapshot["started"]: return rejectRequest(403, "Game not started")
      if actiondata["type"] == "play":
        newhand = roomsnapshot[cp]
        newtalon = roomsnapshot["talon"]
        if actiondata["card"] not in newhand: return rejectRequest(403, "You don't have card %s!" % actiondata["card"])
        newtalon.append(actiondata["card"])
        del newhand[newhand.index(actiondata["card"])]
        room.set({
          cp: newhand,
          "talon": newtalon,
          "turn": (roomsnapshot["turn"]+1) % roomsnapshot["playercount"],
          "lastPlay": "play " + actiondata["card"]
        }, merge=True)

        if not bool(newhand) and roomsnapshot["turn"] == roomsnapshot["playercount"] - 1:
          redistributeCards()

        return ok
      elif actiondata["type"] == "capture":
        newhand = roomsnapshot[cp]
        if actiondata["card"] not in newhand: return rejectRequest(403, "You don't have card %s!" % actiondata["card"])
        del newhand[newhand.index(actiondata["card"])]
        newtalon = []
        captured = []
        points = roomsnapshot["points"]
        for card in roomsnapshot["talon"]:
          if card not in actiondata["captures"]: newtalon.append(card)
          else: captured.append(card)
        captured.append(actiondata["card"])
        points[roomsnapshot["turn"]] += evaluatePoints(captured)
        room.set({
          cp: newhand,
          "talon": newtalon,
          "points": points,
          "turn": (roomsnapshot["turn"]+1) % roomsnapshot["playercount"],
          "lastPlay": "capture " + actiondata["card"] + " " + " ".join(actiondata[""])
        }, merge=True);

        if not bool(newhand) and roomsnapshot["turn"] == roomsnapshot["playercount"] - 1:
          redistributeCards()

        return okReq


      return rejectRequest(400, "Invalid action specifier")

    elif actiontype == "chat": return rejectRequest(404, "Chat not implemented yet")
    
    return rejectRequest(404, "Not implemented")

  print("Recieved something!")
  return "Brahmin"


if __name__ == "__main__": 
  print("running on main")
  app.run(host='0.0.0.0', port=3001, debug=False, use_reloader=False)