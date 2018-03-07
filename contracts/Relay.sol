pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract Relay is Ownable {
  address public licenseSalesContractAddress;
  address public registryContractAddress;
  address public apiRegistryContractAddress;
  address public apiCallsContractAddress;
  uint public version;

  // ------------------------------------------------------------------------
  // Constructor, establishes ownership because contract is owned
  // ------------------------------------------------------------------------
  function Relay() public {
    version = 4;
  }

  function setLicenseSalesContractAddress(address newAddress) public onlyOwner {
    require(newAddress != address(0));
    licenseSalesContractAddress = newAddress;
  }

  function setRegistryContractAddress(address newAddress) public onlyOwner {
    require(newAddress != address(0));
    registryContractAddress = newAddress;
  }

  function setApiRegistryContractAddress(address newAddress) public onlyOwner {
    require(newAddress != address(0));
    apiRegistryContractAddress = newAddress;
  }

  function setApiCallsContractAddress(address newAddress) public onlyOwner {
    require(newAddress != address(0));
    apiCallsContractAddress = newAddress;
  }
}