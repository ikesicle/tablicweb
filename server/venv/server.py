import firebase_admin as firebase
import firebase_admin.firestore as firestore
import firebase_admin.auth as auth
from firebase_admin import credentials
import logging
from time import sleep
from flask import Flask, make_response, Response, jsonify, request, abort, render_template
import threading
import asyncio
from tablic import evaluatePoints
from cfg import *
import os
from datetime import datetime, timedelta, timezone
from waitress import serve
from flask_cors import CORS as cors
import copy
import schedule
from random import randint

path = os.path.dirname(os.path.abspath(__file__))

cred = credentials.Certificate(path+certadmin)
firebase.initialize_app(cred)

fstore = firestore.client()
rooms = fstore.collection("rooms")

app = Flask(__name__)
cors(app)

logging.basicConfig(format="[%(asctime)s] %(levelname)s: %(message)s", datefmt="%m/%d/%Y @ %I:%M %p")

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
            #print(roomsnapshot["points"])
            lcp = roomsnapshot["lastcaptureplayer"]
            if lcp == None:
              lcp = randint(0, roomsnapshot["playercount"]-1)
            roomsnapshot["points"][lcp] += evaluatePoints(roomsnapshot["talon"])
            roomsnapshot["capturecount"][lcp] += len(roomsnapshot["talon"])

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
            #print(roomsnapshot["points"])
            lpcommand = roomsnapshot["lastPlay"].split(' ')
            lastplayduration = 0
            print(f"{lpcommand} - ", end="")
            if (lpcommand.pop(0) == "capture"): lastplayduration = len(lpcommand) * 0.1 + 3 + (2 if not roomsnapshot["talon"] else 0)
            print(lastplayduration)
            await asyncio.sleep(lastplayduration);
            if roomsnapshot["talon"]:
              room.update({
                "lastPlay": "capture " + " ".join(roomsnapshot["talon"]),
                "talonprev": roomsnapshot["talon"],
                "talon": [],
                "points": roomsnapshot["points"],
                "capturecount": roomsnapshot["capturecount"]
              })
              lastplayduration = len(roomsnapshot["talon"]) * 0.1 + 3
              await asyncio.sleep(lastplayduration)
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
      pindex = roomsnapshot['turnorder'][roomsnapshot['turn']]
      roomsnapshot["turnorder"] = list(map(lambda x: x-1 if x > pindex else x, roomsnapshot["turnorder"]))
      del roomsnapshot["turnorder"][roomsnapshot['turn']];
      hands.append([])
      roomsnapshot["capturecount"].append(0)
      roomsnapshot["teamdist"].append(0)
      roomsnapshot["points"].append(0)

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
        roomsnapshot["lastPlay"] = "capture " + actiondata["card"] + " " + " ".join(actiondata["captures"])
        roomsnapshot["talonprev"] = copy.deepcopy(roomsnapshot["talon"])
        roomsnapshot["talon"] = newtalon
        roomsnapshot["points"] = points
        roomsnapshot["capturecount"] = capturecount
        roomsnapshot["lastcaptureplayer"] = cpind
        room.update({
          cp: newhand,
          "talonprev": roomsnapshot["talonprev"],
          "talon": roomsnapshot["talon"],
          "points": roomsnapshot["points"],
          "lastPlay": roomsnapshot["lastPlay"],
          "capturecount": roomsnapshot["capturecount"],
          "lastcaptureplayer": roomsnapshot["lastcaptureplayer"]
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
      print("Scheduler Thread Start OK")
      while not stopper.is_set():
        schedule.run_pending()
        sleep(5)
      print("Scheduler Thread Terminate OK")
  cleaner = ScheduleThread()
  cleaner.start()
  return stopper

def periodicCleanupRooms():
  alldocs = rooms.list_documents()
  now = datetime.now(tz=timezone.utc)
  print(f"Performing routine cleanup - {now}")
  for dRef in alldocs:
    datedata = dRef.get(['date', 'lastactivity', 'players', 'roomflags'])
    if not datedata.exists: continue
    latest = max(datedata.get('date'), datedata.get('lastactivity'))
    logtxt = f"{dRef.id} - {now-latest} -"

    if now - latest > timedelta(hours=1):
      dRef.delete()
      for message in list(dRef.collections())[0].list_documents():
        message.delete()
      for player in datedata.get('players'):
        try:
          userToModify = fstore.document("userstates/"+player)
          userToModify.update({
            "inGame" : ""
          });
        except:
          pass
      print(f"{logtxt} Closed room {dRef.id} for inactivity.")
    
    elif now-latest > timedelta(minutes=50):
      if 'inactive50' not in datedata.get('roomflags'):
        list(dRef.collections())[0].add({
          "message": f"This room will be closed in 10 minutes due to inactivity. Time of Warning: {now}",
          "senderID": "0",
          "senderName": "[ System ]",
          "spectate": False,
          "timestamp": now
        })
        dRef.update({
          "roomflags": datedata.get('roomflags') + ["inactive50"]
        })
      print(f"{logtxt} < 10 mins remaining")

    elif now-latest > timedelta(minutes=30):
      if 'inactive30' not in datedata.get('roomflags'):
        list(dRef.collections())[0].add({
          "message": f"Warning: This room will be closed in 30 minutes due to inactivity. Time of Warning: {now}",
          "senderID": "0",
          "senderName": "[ System ]",
          "spectate": False,
          "timestamp": now
        })
        dRef.update({
          "roomflags": datedata.get('roomflags') + ["inactive30"]
        })
      print(f"{logtxt} < 30 mins remaining")
    else:
      #print(f"Room {dRef.id} is okay.")
      dRef.update({
        "roomflags": list([x for x in datedata.get('roomflags') if x not in ('inactive30', 'inactive50')])
      });
      print(logtxt)

def periodicUserCleanup():
  userslist = auth.list_users()
  now = datetime.now(tz=timezone.utc)
  print(f"Performing daily user cleanup - {now}")
  todelete = []
  for user in userslist.iterate_all():
    userdata = fstore.document("userstates/"+user.uid)
    userfile = userdata.get()
    if not userfile.exists: 
      todelete.append(user.uid)
      print(f"Deleted User {user.display_name} [{user.uid}] due to having an invalid or nonexisting user entry.")
      continue
    else:
      try:
        lastlogin = userfile.get('lastlogin')
        if now-lastlogin > timedelta(days=90):
          userdata.delete()
          todelete.append(user.uid)
          print(f"Deleted User {user.display_name} [{user.uid}] due to being inactive for more than 90 days.")
          continue
      except KeyError:
        userdata.delete()
        todelete.append(user.uid)
        print(f"Deleted User {user.display_name} [{user.uid}] due to having improperly formatted user data.")
        continue
    print(f"User {user.display_name} is OK.")
  auth.delete_users(todelete)
  print(f"Purged a total of {len(todelete)} users.")

if __name__ == "__main__":
  schedule.every().minute.do(periodicCleanupRooms)
  schedule.every().day.at("23:59").do(periodicUserCleanup)
  cleanup = bgschedule()
  #app.run(host='0.0.0.0', port=3001, debug=True, use_reloader=True)
  serve(app, port=int(os.environ.get("PORT", 8080)))
  cleanup.set()

  