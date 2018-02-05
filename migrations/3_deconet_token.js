var DeconetToken = artifacts.require("./DeconetToken.sol");

module.exports = function(deployer) {
  deployer.deploy(DeconetToken);
};
