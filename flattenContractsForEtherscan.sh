#!/bin/bash

mkdir -p flatContracts

rm -rf flatContracts/*

for filename in contracts/*.sol; do
    [ -e "$filename" ] || continue
    flat -input $filename -output flatContracts/$filename

done