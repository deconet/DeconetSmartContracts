module.exports = {
  accounts: 99,
  port: 8997,
  testrpcOptions: '-a 99 --port 8997 -i 95 -e 1000 --noVMErrorsOnRPCResponse',
  copyPackages: ['openzeppelin-solidity'],
  compileCommand: '../node_modules/.bin/truffle compile',
  testCommand: '../node_modules/.bin/truffle test --network coverage',
  skipFiles: [
    'Migrations.sol',
    'ds-value/',
    'Medianizer.sol'
  ]
};
