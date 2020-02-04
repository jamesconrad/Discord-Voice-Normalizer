#!/bin/bash
##Main script to handle bot execution

while true; do
    node index.js &>>log
    val=$?
    if [$val -eq 0]; then
        echo "Pulling from Github."
        git pull origin/master
        echo "Pull complete, Restarting."
    else
        echo "Program exited unsuccessfully, Restarting."
    fi
done