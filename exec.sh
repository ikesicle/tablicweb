#!/bin/bash

# Start the first process
npm start > /dev/null &
p1=$! 
echo $p1
# Start the second process
python ./server/venv/server.py
  
# Exit with status of process that exited first
exit $p1