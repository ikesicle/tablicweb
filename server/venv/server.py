import firebase_admin as firebase
import firebase_admin.firestore as firestore
from firebase_admin import credentials
from time import sleep
from flask import Flask, make_response, Response, jsonify, request, abort, render_template
import threading
import asyncio
from tablic import evaluatePoints
from cfg import config
import os
from datetime import datetime, timedelta, timezone
from waitress import serve
from flask_cors import CORS as cors

path = os.path.dirname(os.path.abspath(__file__))

cred = credentials.Certificate(path+"/tablicweb-firebase-adminsdk-90wfc-12e45345a3.json")
firebase.initialize_app(cred)

fstore = firestore.client()
rooms = fstore.collection("rooms")

app = Flask(__name__)
cors(app)

"""
logging.basicConfig(
  filename="/tmp/debug.log",
  filemode="w+",
  level="DEBUG",
  format="[%(asctime)s.%(msecs)03d] %(levelname)s... %(message)s",
  datefmt='%H:%M:%S'
)


wsl = logging.getLogger('websockets')
wsl.setLevel(logging.DEBUG)
wsl.addHandler(logging.StreamHandler())

logwkzg = logging.getLogger('werkzeug')
logwkzg.setLevel(logging.ERROR)
"""

@app.route("/gamehost", methods = ["POST", "GET"])
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
    userid = request.headers["userid"]
    gameid = request.headers["gameid"]
    actiondata = request.json
    room = None
    try:
      room = fstore.document("rooms/" + gameid)
    except: return rejectRequest(404, "Room not found.")

    roomsnapshot = room.get()
    if not roomsnapshot.exists: return rejectRequest(404, "Room no longer exists.")
    print("Serving Game Request - "+roomsnapshot.id)
    roomsnapshot = roomsnapshot._data

    def redistributeCards():
      hands = {
        "p1hand": [],
        "p2hand": [],
        "p3hand": [],
        "p4hand": [],
      }
      newdeck = roomsnapshot["deck"]
      for rpt in range(0,2):
        for playerhands in range(0, roomsnapshot["playercount"]):
          lcp = "p" + str(playerhands+1) + "hand"
          hands[lcp] += newdeck[:3]
          newdeck = newdeck[3:]
      hands["deck"] = newdeck
      room.update(hands)

    def endTurnAndStartNext():
      room.update({
        "turn": (roomsnapshot["turn"]+1) % roomsnapshot["playercount"],
        "date": datetime.now(tz=timezone.utc)
      })
      if not bool(newhand) and roomsnapshot["turn"] == roomsnapshot["playercount"] - 1:
          if not roomsnapshot["deck"]:
            # End Game
            room.update({
              "started": False,
              "winner": roomsnapshot["playernames"][roomsnapshot["points"].index(max(roomsnapshot["points"]))]
            })
          redistributeCards()
      if roomsnapshot["playercount"] == 1:
        room.update({
          "started": False,
          "winner": roomsnapshot["playernames"][0]
        })

    def removePlayer():
      print("Removing current player " + (roomsnapshot["playernames"])[roomsnapshot["turn"]])
      hands = [roomsnapshot["p1hand"],roomsnapshot["p2hand"],roomsnapshot["p3hand"],roomsnapshot["p4hand"]]
      players = roomsnapshot["players"]
      pnames = roomsnapshot["playernames"]
      pcnt = roomsnapshot["playercount"]
      for i in range(roomsnapshot["turn"],pcnt-1):
        hands[i] = hands[i+1]
        players[i] = players[i+1]
        pnames[i] = pnames[i+1]
      hands[3] = []
      pcnt -= 1
      del pnames[pcnt]
      del players[pcnt]

      room.update({
        "p1hand": hands[0],
        "p2hand": hands[1],
        "p3hand": hands[2],
        "p4hand": hands[3],
        "players": players,
        "playernames": pnames,
        "playercount": pcnt,
        "turn": roomsnapshot["turn"]%pcnt
      })
      if pcnt == 1:
        room.update({
          "started": False,
          "winner": pnames[0]
        })

    if actiondata["datatype"] == "turn":
      print("Recieved a turn action request.")
      cp = "p" + str(roomsnapshot["turn"]+1) + "hand"
      if roomsnapshot["players"][roomsnapshot["turn"]] != userid: return rejectRequest(403, "Not your turn!")
      if not roomsnapshot["started"]: return rejectRequest(403, "Game not started")
      
      if actiondata["type"] == "play":
        newhand = roomsnapshot[cp]
        newtalon = roomsnapshot["talon"]
        if actiondata["card"] not in newhand: return rejectRequest(403, "You don't have card %s!" % actiondata["card"])
        newtalon.append(actiondata["card"])
        del newhand[newhand.index(actiondata["card"])]
        room.update({
          cp: newhand,
          "talon": newtalon,
          "lastPlay": "play " + actiondata["card"]
        } )
        endTurnAndStartNext()
        return okReq
      
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
        if newtalon == []:
          points[roomsnapshot["turn"]] += 1
        room.update({
          cp: newhand,
          "talon": newtalon,
          "points": points,
          "lastPlay": "capture " + actiondata["card"] + " " + " ".join(actiondata["captures"])
        });
        
        endTurnAndStartNext()

        return okReq

      return rejectRequest(400, "Invalid action specifier")

    elif actiondata["datatype"] == "chat": return rejectRequest(404, "Chat not implemented yet")

    elif actiondata["datatype"] == "update":
      print("Recieved an update request.")
      await asyncio.sleep(1)
      ctime = datetime.now(tz=timezone.utc)
      limittime = (roomsnapshot["date"] + timedelta(seconds=30)) if roomsnapshot["date"] else ctime
      if ctime <= limittime:
        print("Within alloted answer time, ignoring")
        return okReq
      
      cturn = roomsnapshot["turn"]
      if cturn == room.get()._data["turn"]:
        removePlayer()
      return okReq

    return rejectRequest(404, "Not implemented")

  elif request.method == "GET":
    return okReq

  return rejectRequest(501, "Unsupported HTTP Method.")


if __name__ == "__main__": 
  #app.run(host='0.0.0.0', port=3001, debug=True, use_reloader=True)
  serve(app)