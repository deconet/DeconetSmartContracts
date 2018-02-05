var ExceptionRegistry = artifacts.require("./ExceptionRegistry.sol");

module.exports = function(deployer) {
  deployer.deploy(ExceptionRegistry);
};