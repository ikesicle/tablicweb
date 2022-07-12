import firebase_admin as firebase
import firebase_admin.firestore as firestore
import firebase_admin.auth as auth
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
import copy
import schedule

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

def verify(token, uid):
  verified = auth.verify_id_token(token)
  return verified["uid"] == uid

def rejectRequest(code, msg):
    resp = make_response(msg)
    resp.status_code = code
    resp.headers["content-type"] = "text/plain"
    return resp

@app.route("/gamehost", methods = ["POST", "GET"])
async def gamehost():
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
    roomsnapshot = roomsnapshot._data
    
    cpind = roomsnapshot["turnorder"][roomsnapshot["turn"]]
    cp = "p" + str(cpind+1) + "hand"

    def redistributeCards(): # Redistirubtes cards as evenly as possible.
      hands = {
        "p1hand": [],
        "p2hand": [],
        "p3hand": [],
        "p4hand": [],
      }
      newdeck = roomsnapshot["deck"]
      for rpt in range(0, 1 if roomsnapshot["gamemode"] == "TEM" else 2):
        togive = 3
        if len(newdeck) < roomsnapshot["playercount"] * 3:
          togive = len(newdeck) // roomsnapshot["playercount"]
        for playerhands in range(0, roomsnapshot["playercount"]):
          lcp = "p" + str(playerhands+1) + "hand"
          hands[lcp] += newdeck[:togive]
          newdeck = newdeck[togive:]
      hands["deck"] = newdeck
      room.update(hands)

    async def endTurnAndStartNext(): # Ends the current turn and starts next. Redeals if hands are empty, and ends game if deck is empty.
      nxt = (roomsnapshot["turn"]+1) % roomsnapshot["playercount"]
      room.update({
        "turn": nxt,
        "date": datetime.now(tz=timezone.utc)
      })
      if not bool(newhand) and roomsnapshot["turn"] == roomsnapshot["playercount"] - 1:
          if not roomsnapshot.get("deck", []):
            # End Game
            print(roomsnapshot["points"])
            roomsnapshot["points"][roomsnapshot["turnorder"][cpind]] += evaluatePoints(roomsnapshot["talon"])
            roomsnapshot["capturecount"][roomsnapshot["turnorder"][cpind]] += len(roomsnapshot["talon"])

            indx = roomsnapshot["capturecount"].index(max(roomsnapshot["capturecount"]))
            if roomsnapshot["points"].count(roomsnapshot["points"][indx]) == 1: roomsnapshot["points"][indx] += 3
            
            winnerscore = max(roomsnapshot["points"])
            winners = []
            for i in range(0,roomsnapshot["playercount"]):
              if (roomsnapshot["points"][i] == winnerscore): winners.append(roomsnapshot["playernames"][i])

            winner = ", ".join(winners)
            # Implementing draws
            if roomsnapshot["gamemode"] == "TEM":
              blue = 0
              red = 0
              for i in range(0,4):
                if roomsnapshot["teamdist"][i]: blue += points[i]
                else: red += points[i]
              if blue == red:
                winner = "Tie"
                winnerscore = red
              elif blue > red:
                winner = "Blue Team"
                winnerscore = blue
              else:
                winner = "Red Team"
                winnerscore = red
            room.update({
              "started": "ending"
            })
            print(roomsnapshot["points"])
            await asyncio.sleep(3);
            room.update({
              "lastPlay": "capture " + " ".join(roomsnapshot["talon"]),
              "talonprev": roomsnapshot["talon"],
              "talon": [],
              "points": roomsnapshot["points"],
              "capturecount": roomsnapshot["capturecount"]
            })
            await asyncio.sleep(4)
            room.update({
              "started": "",
              "winner": winner,
              "winnerscore": winnerscore,
            })
          else: redistributeCards()
      if roomsnapshot["playercount"] == 1:
        room.update({
          "started": "",
          "winner": roomsnapshot["playernames"][0],
          "points": roomsnapshot["points"][0]
        })

    async def removePlayer(): # Removes the current player from play.
      hands = [roomsnapshot["p1hand"],roomsnapshot["p2hand"],roomsnapshot["p3hand"],roomsnapshot["p4hand"]]
      pcnt = roomsnapshot["playercount"]
      if pcnt < cpind + 1:
        room.update({
          "turn": roomsnapshot["turn"]%pcnt,
        });
        return
      try:
        userToModify = fstore.document("userstates/"+roomsnapshot["players"][cpind])
        userToModify.update({
          "inGame" : ""
        })
      except:
        pass
      
      pcnt -= 1
      del hands[cpind]
      del roomsnapshot["playernames"][cpind]
      del roomsnapshot["players"][cpind]
      del roomsnapshot["capturecount"][cpind]
      del roomsnapshot["teamdist"][cpind]
      del roomsnapshot["points"][cpind]
      print(f"Old Turn Order: {roomsnapshot['turnorder']}")
      pindex = roomsnapshot['turnorder'][roomsnapshot['turn']]
      print(f"Player index to be removed: {pindex}")
      roomsnapshot["turnorder"] = list(map(lambda x: x-1 if x > pindex else x, roomsnapshot["turnorder"]))
      del roomsnapshot["turnorder"][roomsnapshot['turn']];
      print(f"New Turn Order: {roomsnapshot['turnorder']}")
      hands.append([])
      roomsnapshot["capturecount"].append(0)
      roomsnapshot["teamdist"].append(0)
      roomsnapshot["points"].append(0)

      print(cpind)
      print(roomsnapshot["players"])

      room.update({
        "p1hand": hands[0],
        "p2hand": hands[1],
        "p3hand": hands[2],
        "p4hand": hands[3],
        "players": roomsnapshot["players"],
        "playernames": roomsnapshot["playernames"],
        "playercount": pcnt,
        "turn": roomsnapshot["turn"]%pcnt,
        "turnorder": roomsnapshot["turnorder"],
        "capturecount": roomsnapshot["capturecount"],
        "teamdist": roomsnapshot["teamdist"],
        "points": roomsnapshot["points"],
        "date": datetime.now(tz=timezone.utc)
      })

      teamNoContinue = roomsnapshot["gamemode"] == "TEM" and roomsnapshot["teamdist"].count(1) == 0
      if pcnt == 1 or teamNoContinue:
        room.update({
          "started": "",
          "winner": "Game ended prematurely",
          "points": [0,0,0,0],
          "winnerscore": "NaN"
        })

    if actiondata["datatype"] == "turn":
      if roomsnapshot["players"][cpind] != userid: return rejectRequest(403, "Not your turn!")
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
        await endTurnAndStartNext()
        return okReq
      
      elif actiondata["type"] == "capture":
        newhand = roomsnapshot[cp]
        if actiondata["card"] not in newhand: return rejectRequest(403, "You don't have card %s!" % actiondata["card"])
        del newhand[newhand.index(actiondata["card"])]
        newtalon = []
        captured = []
        capturecount = roomsnapshot["capturecount"]
        points = roomsnapshot["points"]
        for card in roomsnapshot["talon"]:
          if card not in actiondata["captures"]: newtalon.append(card)
          else: captured.append(card)
        captured.append(actiondata["card"])
        points[cpind] += evaluatePoints(captured)
        if newtalon == []:
          points[cpind] += 1
        capturecount[cpind] += len(captured)
        room.update({
          cp: newhand,
          "talonprev": roomsnapshot["talon"],
          "talon": newtalon,
          "points": points,
          "lastPlay": "capture " + actiondata["card"] + " " + " ".join(actiondata["captures"]),
          "capturecount": capturecount
        })
        await endTurnAndStartNext()
        return okReq

      return rejectRequest(400, "Invalid action specifier")

    elif actiondata["datatype"] == "update":
      await asyncio.sleep(1)
      ctime = datetime.now(tz=timezone.utc)
      limittime = (roomsnapshot["date"] + timedelta(seconds=30)) if roomsnapshot["date"] else ctime
      if ctime <= limittime:
        return okReq
      
      cturn = roomsnapshot["turn"]
      if cturn == room.get()._data["turn"]:
        await removePlayer()
      return okReq

    return rejectRequest(404, "Not implemented")

  elif request.method == "GET":
    return okReq

  return rejectRequest(501, "Unsupported HTTP Method.")

def bgschedule():
  stopper = threading.Event()
  class ScheduleThread(threading.Thread):
    @classmethod
    def run(cls):
      print("Scheduling thread started.")
      while not stopper.is_set():
        schedule.run_pending()
        sleep(1)
      print("Scheduling thread stopped.")
  cleaner = ScheduleThread()
  cleaner.start()
  return stopper

def periodicCleanup():
  alldocs = rooms.list_documents()
  now = datetime.now(tz=timezone.utc)
  print("Routine checkup of rooms:")
  for dRef in alldocs:
    datedata = dRef.get(['date'])
    if not datedata.exists: continue
    roomupdate = datedata.get('date')
    roomupdate = datetime(1,1,1,tzinfo=timezone.utc) if not roomupdate else roomupdate
    chatupdate = list(list(dRef.collections())[0].order_by('timestamp',direction='DESCENDING').get())[0].get('timestamp')
    latest = max(roomupdate, chatupdate)
    if now - latest > timedelta(seconds = 5): 
      dRef.delete()
      print(f"Room {dRef.id} was purged for being inactive for {now-latest}")
    else:
      print(f"Room {dRef.id} is okay.")



if __name__ == "__main__":
  schedule.every(10).seconds.do(periodicCleanup)
  cleanup = bgschedule()
  app.run(host='0.0.0.0', port=3001, debug=True, use_reloader=True)
  cleanup.set()
  #serve(app, port=int(os.environ.get("PORT", 8080)))

  