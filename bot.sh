#!/bin/bash
##Main script to handle bot execution

valid=true
while [$valid]
do
    node index.js
    val=$?
    if [$val -eq 0];
    then
        echo "Pulling from Github."
        git pull origin/master
        echo "Pull complete, Restarting."
    else
        echo "Program exited unsuccessfully, Restarting."
    fi
done