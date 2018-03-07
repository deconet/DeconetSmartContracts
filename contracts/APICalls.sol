pragma solidity 0.4.19;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Relay.sol";
import "./APIRegistry.sol";
import "./DeconetToken.sol";


// ----------------------------------------------------------------------------
// Records api calls and payment for them
// ----------------------------------------------------------------------------
contract APICalls is Ownable {
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

  // maps apiId to a APIBalance which stores how much each address owes
  mapping(uint => APIBalance) internal owed;

  // maps buyer addresses to whether or not accounts are overdrafted and more
  mapping(address => BuyerInfo) internal buyers;

  struct APIBalance {
    // maps address -> amount owed in wei
    mapping(address => uint) amounts;
    // basically a list of keys for the above map
    address[] nonzeroAddresses;
  }

  struct BuyerInfo {
    // whether or not the account is overdrafted or not
    bool overdrafted;
    // total number of overdrafts, ever
    uint lifetimeOverdraftCount;
    // credits on file with this contract (wei)
    uint credits;
    // total amount of credits used / spent, ever (wei)
    uint lifetimeCreditsUsed;
  }

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

    APIBalance storage apiBalance = owed[apiId];

    if (apiBalance.amounts[buyerAddress] == 0) {
      // add buyerAddress to list of addresses with nonzero balance for this api
      apiBalance.nonzeroAddresses.push(buyerAddress);
    }

    apiBalance.amounts[buyerAddress] = apiBalance.amounts[buyerAddress].add(totalPrice);

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

    // make sure it's a legit real api
    require(pricePerCall != 0 && sellerUsername != "" && apiName != "" && sellerAddress != address(0));

    // calculate totalPayable for the api
    uint totalPayable = calculateTotalPayable(apiId);

    // calculate fee and payout
    // fixed point math at 2 decimal places
    uint fee = totalPayable.mul(100).div(saleFee).div(100);
    uint payout = totalPayable.sub(fee);

    APICallsPaid(
      apiId,
      sellerAddress,
      totalPayable,
      tokenReward,
      fee
    );

    // give seller some tokens for the sale
    rewardTokens(sellerAddress);

    // transfer seller the eth
    sellerAddress.transfer(payout);
  }

  function addCredits(address _to) public payable {
    BuyerInfo storage buyer = buyers[_to];
    buyer.credits = buyer.credits.add(msg.value);
  }

  function withdrawCredits() public {
    BuyerInfo storage buyer = buyers[msg.sender];
    require(buyer.credits > 0);
    uint creditsToSend = buyer.credits;
    buyer.credits = 0;
    msg.sender.transfer(creditsToSend);
  }

  function rewardTokens(address toReward) private {
    DeconetToken token = DeconetToken(tokenContractAddress);
    address tokenOwner = token.owner();

    // check balance of tokenOwner
    uint tokenOwnerBalance = token.balanceOf(tokenOwner);
    uint tokenOwnerAllowance = token.allowance(tokenOwner, address(this));
    if (tokenOwnerBalance >= tokenReward && tokenOwnerAllowance >= tokenReward) {
      token.transferFrom(tokenOwner, toReward, tokenReward);
    }
  }

  function calculateTotalPayable(uint apiId) private returns (uint) {
    APIBalance storage apiBalance = owed[apiId];

    uint totalPayable = 0;
    address[] storage newNonzeroAddresses;
    for (uint i = 0; i < apiBalance.nonzeroAddresses.length; i++) {
      address buyerAddress = apiBalance.nonzeroAddresses[i];
      BuyerInfo storage buyer = buyers[buyerAddress];
      uint buyerOwes = apiBalance.amounts[buyerAddress];
      int creditsAfter = int(buyer.credits) - int(buyerOwes);
      if (creditsAfter < 0) {
        // if the buyer doesn't have enough credits to pay the seller the full balance they owe,
        // just send however much they do have
        totalPayable = totalPayable.add(buyer.credits);

        // store that the buyer now only owes the difference
        apiBalance.amounts[buyerAddress] = buyerOwes.sub(buyer.credits);

        // their address still owes money for this api, so keep it in the nonzeroAddresses array
        newNonzeroAddresses.push(buyerAddress);

        // store credits in total credits spent
        buyer.lifetimeCreditsUsed = buyer.lifetimeCreditsUsed.add(buyer.credits);

        // zero out the buyers credits
        buyer.credits = 0;

        // mark address as overdrafted so that seller can cut off service
        buyer.overdrafted = true;
        buyer.lifetimeOverdraftCount += 1;
      } else {
        // add the total owed to the total payable
        totalPayable = totalPayable.add(buyerOwes);

        // remove the total owed
        apiBalance.amounts[buyerAddress] = 0;

        // remove the spent credits from the credits map
        buyer.credits = uint(creditsAfter);

        // mark address as in good standing
        buyer.overdrafted = false;

        // store credits in total credits spent
        buyer.lifetimeCreditsUsed = buyer.lifetimeCreditsUsed.add(buyerOwes);
      }
    }

    // set list of addresses with nonzero owed amount for api
    apiBalance.nonzeroAddresses = newNonzeroAddresses;
    return totalPayable;
  }
}
