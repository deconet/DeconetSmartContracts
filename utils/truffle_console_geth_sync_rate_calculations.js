// paste into truffle console, more info here https://medium.com/@cvcassano/using-truffle-console-to-check-how-long-geth-will-take-to-sync-51935652d0e7

let before = 0
let beforeTime = 0

web3.eth.getSyncing(function(err, ct){ console.log(ct); before = ct.currentBlock; beforeTime = new Date() })

let calcFunc = (ct) => { console.log(ct); let remainingSecs = ((ct.highestBlock - ct.currentBlock) / ((ct.currentBlock - before) / ((new Date() - beforeTime) / 1000.0))); console.log('Estimated time remaining: ' + remainingSecs + ' seconds which is ' + (remainingSecs / 60.0) + ' minutes and did ' + (ct.currentBlock - before) + ' blocks in ' + ((new Date() - beforeTime) / 1000.0) + ' seconds for a rate of ' + ((ct.currentBlock - before) / ((new Date() - beforeTime) / 1000.0)) + ' blocks per second.' ) }
let getBlockFunc = () => { web3.eth.getSyncing((err, ct) => { calcFunc(ct) }) }

// wait like 10 seconds and run getBlockFunc()


// to just print block height:
// web3.eth.getSyncing(function(err, ct){ console.log(ct); });