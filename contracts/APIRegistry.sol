pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract APIRegistry is Ownable {

  struct APIForSale {
    uint pricePerCall;
    bytes32 sellerUsername;
    bytes32 apiName;
    address sellerAddress;
    string hostname;
    string docsUrl;
  }

  mapping(string => uint) internal apiIds;
  mapping(uint => APIForSale) public apis;

  uint public numApis;
  uint public version;

  // ------------------------------------------------------------------------
  // Constructor, establishes ownership because contract is owned
  // ------------------------------------------------------------------------
  function APIRegistry() public {
    numApis = 0;
    version = 1;
  }

  function listApi(uint pricePerCall, bytes32 sellerUsername, bytes32 apiName, string hostname, string docsUrl) public {
    // make sure input params are valid
    require(pricePerCall != 0 && sellerUsername != "" && apiName != "" && bytes(hostname).length != 0);
    
    // make sure the name isn't already taken
    require(apiIds[hostname] == 0);

    numApis += 1;
    apiIds[hostname] = numApis;

    APIForSale storage api = apis[numApis];

    api.pricePerCall = pricePerCall;
    api.sellerUsername = sellerUsername;
    api.apiName = apiName;
    api.sellerAddress = msg.sender;
    api.hostname = hostname;
    api.docsUrl = docsUrl;
  }

  function getApiId(string hostname) public view returns (uint) {
    return apiIds[hostname];
  }

  function getApiById(uint apiId) public view returns (uint pricePerCall, bytes32 sellerUsername, bytes32 apiName, address sellerAddress, string hostname, string docsUrl) {
    APIForSale storage api = apis[apiId];

    pricePerCall = api.pricePerCall;
    sellerUsername = api.sellerUsername;
    apiName = api.apiName;
    sellerAddress = api.sellerAddress;
    hostname = api.hostname;
    docsUrl = api.docsUrl;
  }

  function getApiByName(string _hostname) public view returns (uint pricePerCall, bytes32 sellerUsername, bytes32 apiName, address sellerAddress, string hostname, string docsUrl) {
    uint apiId = apiIds[_hostname];
    if (apiId == 0) {
      return;
    }
    APIForSale storage api = apis[apiId];

    pricePerCall = api.pricePerCall;
    sellerUsername = api.sellerUsername;
    apiName = api.apiName;
    sellerAddress = api.sellerAddress;
    hostname = api.hostname;
    docsUrl = api.docsUrl;
  }

  function editApi(uint apiId, uint pricePerCall, address sellerAddress, string docsUrl) public {
    APIForSale storage api = apis[apiId];

    // require that sender is the original api lister, or the contract owner
    // the contract owner clause lets us recover a api listing if a dev loses access to their privkey
    require(msg.sender == api.sellerAddress || msg.sender == owner);

    api.pricePerCall = pricePerCall;
    api.sellerAddress = sellerAddress;
    api.docsUrl = docsUrl;
  }
}