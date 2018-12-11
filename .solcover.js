module.exports = {
  testrpcOptions: '--accounts 100 --port 8997 -e 1000 --noVMErrorsOnRPCResponse',
  // norpc: true,
  copyPackages: ['zeppelin-solidity'],
  skipFiles: [
    'Migrations.sol',
    'ds-value/',
    'Medianizer.sol'
  ]
};
