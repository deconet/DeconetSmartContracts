pragma solidity ^0.4.19;

import "./Owned.sol";

contract Registry is Owned {

  struct ModuleForSale {
      uint price;
      string sellerUsername;
      string moduleName;
      address sellerAddress;
  }

  mapping(string => uint) moduleIds;
  mapping(uint => ModuleForSale) modules;

  uint public numModules;

  // ------------------------------------------------------------------------
  // Constructor, establishes ownership because contract is owned
  // ------------------------------------------------------------------------
  function Registry() public {
    numModules = 0;
  }

  function listModule(uint price, string sellerUsername, string moduleName, string usernameAndProjectName) public {
    // make sure the name isn't already taken
    require(moduleIds[usernameAndProjectName] == 0);

    numModules += 1;
    moduleIds[usernameAndProjectName] = numModules;

    var module = modules[numModules];

    module.price = price;
    module.sellerUsername = sellerUsername;
    module.moduleName = moduleName;
    module.sellerAddress = msg.sender;
  }

  function getModuleId(string usernameAndProjectName) public view returns (uint) {
    return moduleIds[usernameAndProjectName];
  }

  function getModule(uint moduleId) public view returns (uint price, string sellerUsername, string moduleName, address sellerAddress) {
    var module = modules[moduleId];

    price = module.price;
    sellerUsername = module.sellerUsername;
    moduleName = module.moduleName;
    sellerAddress = module.sellerAddress;
  }

  function editModule(uint moduleId, uint price, address sellerAddress) public onlyOwner {
    var module = modules[moduleId];

    module.price = price;
    module.sellerAddress = sellerAddress;
  }
}