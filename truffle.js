var HDWalletProvider = require('truffle-hdwallet-provider');

const LedgerWalletProvider = require('truffle-ledger-provider');

// const LedgerProviderFactory = require("truffle-ledger-wallet-provider");

// const LedgerWalletProvider = require("./utils/deconet-truffle-ledger-provider");

const ledgerOptions = {
  networkId: 1,
  path: "44'/60'/0'/0",
  askConfirm: false,
  accountsLength: 1,
  accountsOffset: 0,
};  

// matching address is 0x648d692e5c507c233d0f9d9fea062429003b3144
let mnemonic = process.env.DECONET_BLOCKCHAIN_ROPSTEN_MNEMONIC;

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*' // Match any network id
    },
    ropsten: {
      provider: /*function() {
        return new LedgerWalletProvider(ledgerOptions, 'https://ropsten.infura.io/JTdaA5dJvlwfCfdgT5Cm')
      },*/
      function () {
        // remote infura
        // return new HDWalletProvider(mnemonic, 'https://ropsten.infura.io/JTdaA5dJvlwfCfdgT5Cm')
        // local GETH which supports debug
        // return new HDWalletProvider(mnemonic, 'http://127.0.0.1:8549')
        // remote GETH
        //return new HDWalletProvider(mnemonic, process.env.DECONET_ROPSTEN_NODE_URL)
        // geonda.io
        return new HDWalletProvider(mnemonic, 'http://35.170.208.0:8545')
      },
      network_id: 3,
      gas: 4700000,
      gasPrice: 10000000000 // 10 gwei
    },
    mainnet: {
      provider: function() {
        return new LedgerWalletProvider(ledgerOptions, 'http://18.208.64.51:8545')
      },
      network_id: 1,
      gas: 7000000,
      gasPrice: 5000000000 // 5 gwei
    },
    rinkeby: {
      provider: function() {
        return new LedgerWalletProvider(ledgerOptions, 'https://rinkeby.infura.io/JTdaA5dJvlwfCfdgT5Cm')
      },
      /*function () {
        return new HDWalletProvider(mnemonic, 'https://rinkeby.infura.io/JTdaA5dJvlwfCfdgT5Cm')
      },*/
      network_id: 4,
      gas: 4700000,
      gasPrice: 3000000000 // 3 gwei
    },
    kovan: {
      provider: function() {
        return new LedgerWalletProvider(ledgerOptions, 'https://kovan.infura.io/JTdaA5dJvlwfCfdgT5Cm')
      },
      /*function () {
        return new HDWalletProvider(mnemonic, 'https://rinkeby.infura.io/JTdaA5dJvlwfCfdgT5Cm')
      },*/
      network_id: 42,
      gas: 4700000,
      gasPrice: 1000000000 // 1 gwei
    },
    coverage: {
      host: "127.0.0.1",
      network_id: "*",
      port: 8997,
      gas: 9007199254740991,
      gasPrice: 0x01
    }
  }
};
