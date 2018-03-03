pragma solidity 0.4.19;

import "./Owned.sol";
import "./Relay.sol";
import "./APIRegistry.sol";
import "./DeconetToken.sol";


// ----------------------------------------------------------------------------
// Records api calls and payment for them
// ----------------------------------------------------------------------------
contract APICalls is Owned {
  using SafeMath for uint;

  // the amount rewarded to a seller for selling api calls
  uint public tokenReward;

  // the fee this contract takes from every sale.  expressed as percent.  so a value of 3 indicates a 3% txn fee
  uint public saleFee;

  // address of the relay contract which holds the address of the registry contract.
  address public relayContractAddress;

  // the token address
  address public tokenContractAddress;

  // this contract version
  uint public version;

  // the address that is authorized to withdraw eth
  address private withdrawlAddress;

  // the address that is authorized to report usage on behalf of deconet
  address private usageReportingAddress;

  // maps apiId to a map of address->uint which stores how much each address owes
  mapping(uint => mapping(address => uint)) internal owed;

  // solidity doesn't store the keys for a map.  
  // so this is a map that maps apiId to an array of addresses with nonzero balance for that apiId
  mapping(uint => address[]) internal nonzeroAddresses;

  // maps buyer addresses to credit balances
  mapping(address => uint) internal credits;

  event APICallsMade(
    uint apiId,
    address indexed sellerAddress,
    address indexed buyerAddress,
    uint pricePerCall,
    uint numCalls,
    uint totalPrice,
    address reportingAddress
  );

  event APICallsPaid(
    uint apiId,
    address indexed sellerAddress,
    address indexed buyerAddress,
    uint totalPrice,
    uint rewardedTokens,
    uint networkFee
  );

  // ------------------------------------------------------------------------
  // Constructor
  // ------------------------------------------------------------------------
  function APICalls() public {
    version = 1;

    // default token reward of 100 tokens.  
    // token has 18 decimal places so that's why 100 * 10^18
    tokenReward = 100 * 10**18;

    // default saleFee of 10%
    saleFee = 10;

    // default withdrawlAddress is owner
    withdrawlAddress = msg.sender;
  }

  // ------------------------------------------------------------------------
  // Owner can transfer out any accidentally sent ERC20 tokens (just in case)
  // ------------------------------------------------------------------------
  function transferAnyERC20Token(address tokenAddress, uint tokens) public onlyOwner returns (bool success) {
    return ERC20Interface(tokenAddress).transfer(owner, tokens);
  }

  // ------------------------------------------------------------------------
  // Owner can transfer out any ETH
  // ------------------------------------------------------------------------
  function withdrawEther() public {
    require(msg.sender == withdrawlAddress);
    withdrawlAddress.transfer(this.balance);
  }

  // ------------------------------------------------------------------------
  // Owner can set address of who can withdraw
  // ------------------------------------------------------------------------
  function setWithdrawlAddress(address _withdrawlAddress) public onlyOwner {
    withdrawlAddress = _withdrawlAddress;
  }

  // ------------------------------------------------------------------------
  // Owner can set address of relay contract
  // ------------------------------------------------------------------------
  function setRelayContractAddress(address _relayContractAddress) public onlyOwner {
    relayContractAddress = _relayContractAddress;
  }

  // ------------------------------------------------------------------------
  // Owner can set address of token contract
  // ------------------------------------------------------------------------
  function setTokenContractAddress(address _tokenContractAddress) public onlyOwner {
    tokenContractAddress = _tokenContractAddress;
  }

  // ------------------------------------------------------------------------
  // Owner can set token reward
  // ------------------------------------------------------------------------
  function setTokenReward(uint _tokenReward) public onlyOwner {
    tokenReward = _tokenReward;
  }

  // ------------------------------------------------------------------------
  // Owner can set the sale fee
  // ------------------------------------------------------------------------
  function setSaleFee(uint _saleFee) public onlyOwner {
    saleFee = _saleFee;
  }

  // ------------------------------------------------------------------------
  // The API owner or the authorized deconet usage reporting address may report usage
  // ------------------------------------------------------------------------
  function reportUsage(uint apiId, uint numCalls, address buyerAddress) public {
    // look up the registry address from relay contract
    Relay relay = Relay(relayContractAddress);
    address apiRegistryAddress = relay.apiRegistryContractAddress();

    // get the module info from registry
    APIRegistry apiRegistry = APIRegistry(apiRegistryAddress);

    uint pricePerCall;
    bytes32 sellerUsername;
    bytes32 apiName;
    address sellerAddress;

    (pricePerCall, sellerUsername, apiName, sellerAddress) = apiRegistry.getApiByIdWithoutDynamics(apiId);

    // make sure the caller is either the api owner or the deconet reporting address
    require(sellerAddress != address(0));
    require(msg.sender == sellerAddress || msg.sender == usageReportingAddress);

    // make sure the module is actually valid
    require(sellerUsername != "" && apiName != "");

    uint totalPrice = pricePerCall.mul(numCalls);

    require(totalPrice > 0);

    if (owed[apiId][buyerAddress] == 0) {
      // add buyerAddress to list of addresses with nonzero balance for this api
      nonzeroAddresses[apiId].push(buyerAddress);
    }

    owed[apiId][buyerAddress] = owed[apiId][buyerAddress].add(totalPrice);

    APICallsMade(
      apiId,
      sellerAddress,
      buyerAddress,
      pricePerCall,
      numCalls,
      totalPrice,
      msg.sender
    );
  }

  function paySeller(uint apiId) public {
    uint totalPayable = 0;
    for (uint i = 0; i < nonzeroAddresses[apiId].length; i++) {
      address buyerAddress = nonzeroAddresses[apiId][i];
      uint buyerOwes = owed[apiId][buyerAddress];
      uint creditsAfter = credits[buyerAddress] - buyerOwes;
      if (creditsAfter < 0) {
        // if the buyer doesn't have enough credits to pay the seller the full balance they owe,
        // just send however much they do have
        totalPayable = totalPayable.add(credits[buyerAddress]);
        // store that the buyer now only owes the difference
        owed[apiId][buyerAddress] = buyerOwes.sub(credits[buyerAddress]);
      } else {
        // add the total owed to the total payable
        totalPayable = totalPayable.add(buyerOwes);
        // remove the total owed
        owed[apiId][buyerAddress] = 0;
      }
      credits[buyerAddress] = creditsAfter; // this might be negative - that's okay.  it means the buyer owes the seller.
    }
    // look up the registry address from relay contract
    Relay relay = Relay(relayContractAddress);
    address apiRegistryAddress = relay.apiRegistryContractAddress();

    // get the module info from registry
    APIRegistry apiRegistry = APIRegistry(apiRegistryAddress);

    uint pricePerCall;
    bytes32 sellerUsername;
    bytes32 apiName;
    address sellerAddress;

    (pricePerCall, sellerUsername, apiName, sellerAddress) = apiRegistry.getApiByIdWithoutDynamics(apiId);

    require(sellerAddress != address(0));

    // calculate fee and payout
    // fixed point math at 2 decimal places
    uint fee = totalPayable.mul(100).div(saleFee).div(100);
    uint payout = totalPayable.sub(fee);

    APICallsPaid(
      apiId,
      sellerAddress,
      buyerAddress,
      totalPayable,
      tokenReward,
      fee
    );

    // give seller some tokens for the sale as well
    DeconetToken token = DeconetToken(tokenContractAddress);
    token.transfer(sellerAddress, tokenReward);

    sellerAddress.transfer(payout);
  }

  function addCredits() public payable {
    credits[msg.sender] = credits[msg.sender].add(msg.value);
  }

  function withdrawCredits() public {
    require(credits[msg.sender] > 0);
    credits[msg.sender] = 0;
    msg.sender.transfer(credits[msg.sender]);
  }
}
