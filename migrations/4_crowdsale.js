var DeconetToken = artifacts.require('./DeconetToken.sol')
var Registry = artifacts.require('./Registry.sol')
var Crowdsale = artifacts.require('./Crowdsale.sol')

const beep = require('../utils/beep')

module.exports = function (deployer, network, accounts) {
  let crowdsale, deconetToken
  deconetToken = DeconetToken.at(DeconetToken.address)

  console.log('Deploying crowdsale')
  deployer.deploy(Crowdsale)
  .then(() => {
    crowdsale = Crowdsale.at(Crowdsale.address)
    console.log('Giving Crowdsale contract ability to transfer 50% of owner tokens')
    let fiftyPercent = '500000000000000000000000000'
    return deconetToken.approve(crowdsale.address, fiftyPercent)
  })
  .then() => {
    console.log('Setting token contract address for Crowdsale')
    return crowdsale.setTokenContractAddress(deconetToken.address)
  }).then(() => {
    beep(3)
    console.log('Done')
  })
}
