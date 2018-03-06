pragma solidity 0.4.19;

import "./Owned.sol";

contract Registry is Owned {

  struct ModuleForSale {
    uint price;
    bytes32 sellerUsername;
    bytes32 moduleName;
    address sellerAddress;
    bytes4 licenseId;
  }

  mapping(string => uint) internal moduleIds;
  mapping(uint => ModuleForSale) public modules;

  uint public numModules;
  uint public version;

  // ------------------------------------------------------------------------
  // Constructor, establishes ownership because contract is owned
  // ------------------------------------------------------------------------
  function Registry() public {
    numModules = 0;
    version = 1;
  }

  function listModule(uint price, bytes32 sellerUsername, bytes32 moduleName, string usernameAndProjectName, bytes4 licenseId) public {
    // make sure the name isn't already taken
    require(moduleIds[usernameAndProjectName] == 0);

    numModules += 1;
    moduleIds[usernameAndProjectName] = numModules;

    ModuleForSale storage module = modules[numModules];

    module.price = price;
    module.sellerUsername = sellerUsername;
    module.moduleName = moduleName;
    module.sellerAddress = msg.sender;
    module.licenseId = licenseId;
  }

  function getModuleId(string usernameAndProjectName) public view returns (uint) {
    return moduleIds[usernameAndProjectName];
  }

  function getModuleById(uint moduleId) public view returns (uint price, bytes32 sellerUsername, bytes32 moduleName, address sellerAddress, bytes4 licenseId) {
    ModuleForSale storage module = modules[moduleId];
    

    if (module.sellerAddress == address(0)) {
      return;
    }

    price = module.price;
    sellerUsername = module.sellerUsername;
    moduleName = module.moduleName;
    sellerAddress = module.sellerAddress;
    licenseId = module.licenseId;
  }

  function getModuleByName(string usernameAndProjectName) public view returns (uint price, bytes32 sellerUsername, bytes32 moduleName, address sellerAddress, bytes4 licenseId) {
    uint moduleId = moduleIds[usernameAndProjectName];
    if (moduleId == 0) {
      return;
    }
    ModuleForSale storage module = modules[moduleId];

    price = module.price;
    sellerUsername = module.sellerUsername;
    moduleName = module.moduleName;
    sellerAddress = module.sellerAddress;
    licenseId = module.licenseId;
  }

  function editModule(uint moduleId, uint price, address sellerAddress, bytes4 licenseId) public {
    // Make sure input params are valid
    // require(price != 0); // potentially can remove
    require(licenseId.length >= 0 && sellerAddress != address(0));

    ModuleForSale storage module = modules[moduleId];

    if (module.sellerAddress == address(0)) {
      return;
    }

    // require that sender is the original module lister, or the contract owner
    // the contract owner clause lets us recover a module listing if a dev loses access to their privkey
    require(msg.sender == module.sellerAddress || msg.sender == owner);

    module.price = price;
    module.sellerAddress = sellerAddress;
    module.licenseId = licenseId;
  }
}