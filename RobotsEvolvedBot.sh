#!/bin/bash
chmod +x stop.sh
sudo docker build -t robotsevolvedbot .
sudo docker run -d --restart always robotsevolvedbot
echo to view container type sudo docker container ls
echo to stop script type ./stop.sh
