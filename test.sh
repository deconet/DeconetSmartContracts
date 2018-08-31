#!/bin/bash

# run through both test cases, with the token reward activated and also without it

truffle test

DECONET_ACTIVATE_TOKEN_REWARD=true truffle test