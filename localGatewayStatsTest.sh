#!/bin/bash

# if [ "$#" -ne 1 ]; then
#     echo "Usage: ./localTestSetup.sh <privateKeyOfGanacheAcctZero>"
#     exit
# fi

# kill existing ganache
pkill -f ganache-cli

ganache-cli -a 99 -m "nasty answer crowd dial special smoke verify replace question alley loan shed" -i 95 &

export PRIVATE_KEY="aa219c9246806a476151d5cc2bcaad563d8aa971895b938679f7c306cfd2cc1f"

# this file deploys everything, then unpauses the token, then sends ETH to the deconet reporter address

truffle migrate --reset --network development

# node unpause_token.js <network> <privateKeyOfGanacheAcctZero>
node utils/unpause_token.js development $PRIVATE_KEY

# sends 30 eth to deconet reporter address (not needed because reporter address is the same as address zero in ganache)
# node utils/send_eth.js $1 $DECONET_REPORTER_ADDRESS 30000000000000000000

# print env vars
node utils/print_env_for_rails_tests.js $PRIVATE_KEY

# set env vars
`node utils/print_env_for_rails_tests.js $PRIVATE_KEY`

# run the tests
cd /Users/chris/Documents/WorkStuff/Deconet/GatewayStats
bundle exec rake test

# clean up and kill ganache
pkill -f ganache-cli