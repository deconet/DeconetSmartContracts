var DeconetToken = artifacts.require('./DeconetToken.sol')
var Registry = artifacts.require('./Registry.sol')
var Crowdsale = artifacts.require('./Crowdsale.sol')

const beep = require('../utils/beep')

module.exports = async (deployer, network, accounts) => {
  let crowdsale, deconetToken
  deconetToken = await DeconetToken.at(DeconetToken.address)

  console.log('Deploying crowdsale')
  await deployer.deploy(Crowdsale)

  crowdsale = await Crowdsale.at(Crowdsale.address)
  console.log('Giving Crowdsale contract ability to transfer 50% of owner tokens')
  let fiftyPercent = '500000000000000000000000000'
  await deconetToken.approve(crowdsale.address, fiftyPercent)


  console.log('Setting token contract address for Crowdsale')
  await crowdsale.setTokenContractAddress(deconetToken.address)

  beep(3)
  console.log('Done')

}
