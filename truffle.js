var HDWalletProvider = require('truffle-hdwallet-provider')
let mnemonic = process.env.DECONET_BLOCKCHAIN_ROPSTEN_MNEMONIC
module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*' // Match any network id
    },
    ropsten: {
      provider: function () {
        return new HDWalletProvider(mnemonic, 'https://ropsten.infura.io/JTdaA5dJvlwfCfdgT5Cm')
      },
      network_id: 3,
      gas: 4700000
    }
  }
}
