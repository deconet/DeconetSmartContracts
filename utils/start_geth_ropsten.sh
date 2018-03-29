#!/bin/bash

geth --fast --port 30312 --rpc --rpcport 8549 --rpcaddr 0.0.0.0 --rpccorsdomain "*" --rpcapi "eth,web3,net,debug"  --testnet