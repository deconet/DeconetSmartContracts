pragma solidity 0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Relay.sol";
import "./APIRegistry.sol";
import "./DeconetToken.sol";
import "../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


// ----------------------------------------------------------------------------
// Records api calls and payment for them
// ----------------------------------------------------------------------------
contract APICalls is Ownable {
    using SafeMath for uint;

    // the amount rewarded to a seller for selling api calls per buyer
    uint public tokenReward;

    // the fee this contract takes from every sale.  expressed as percent.  so a value of 3 indicates a 3% txn fee
    uint public saleFee;

    // if the buyer has never paid, we need to pick a date for when they probably started using the API.
    // This is in seconds and will be subtracted from "now"
    uint public defaultBuyerLastPaidAt;

    // address of the relay contract which holds the address of the registry contract.
    address public relayContractAddress;

    // the token address
    address public tokenContractAddress;

    // this contract version
    uint public version;

    // the amount that can be safely withdrawn from the contract
    uint public safeWithdrawAmount;

    // the address that is authorized to withdraw eth
    address private withdrawAddress;

    // the address that is authorized to report usage on behalf of deconet
    address private usageReportingAddress;

    // maps apiId to a APIBalance which stores how much each address owes
    mapping(uint => APIBalance) internal owed;

    // maps buyer addresses to whether or not accounts are overdrafted and more
    mapping(address => BuyerInfo) internal buyers;

    // Stores amounts owed and when buyers last paid on a per-api and per-user basis
    struct APIBalance {
        // maps address -> amount owed in wei
        mapping(address => uint) amounts;
        // basically a list of keys for the above map
        address[] nonzeroAddresses;
        // maps address -> tiemstamp of when buyer last paid
        mapping(address => uint) buyerLastPaidAt;
        // used to find address position in nonzeroAddresses
        mapping (address => uint) nonzeroAddressesPosition;
    }

    // Stores basic info about a buyer including their lifetime stats and reputation info
    struct BuyerInfo {
        // whether or not the account is overdrafted or not
        bool overdrafted;
        // total number of overdrafts, ever
        uint lifetimeOverdraftCount;
        // credits on file with this contract (wei)
        uint credits;
        // total amount of credits used / spent, ever (wei)
        uint lifetimeCreditsUsed;
        // maps apiId to approved spending balance for each API per second.
        mapping(uint => uint) approvedAmounts;
        // maps apiId to whether or not the user has exceeded their approved amount
        mapping(uint => bool) exceededApprovedAmount;
        // total number of times exceededApprovedAmount has happened
        uint lifetimeExceededApprovalAmountCount;
    }

    // Logged when API call usage is reported
    event LogAPICallsMade(
        uint apiId,
        address indexed sellerAddress,
        address indexed buyerAddress,
        uint pricePerCall,
        uint numCalls,
        uint totalPrice,
        address reportingAddress
    );

    // Logged when seller is paid for API calls
    event LogAPICallsPaid(
        uint apiId,
        address indexed sellerAddress,
        uint totalPrice,
        uint rewardedTokens,
        uint networkFee
    );

    // Logged when the credits from a specific buyer are spent on a specific api
    event LogSpendCredits(
        address indexed buyerAddress,
        uint apiId,
        uint amount,
        bool causedAnOverdraft
    );

    // Logged when a buyer deposits credits
    event LogDepositCredits(
        address indexed buyerAddress,
        uint amount
    );

    // Logged whena  buyer withdraws credits
    event LogWithdrawCredits(
        address indexed buyerAddress,
        uint amount
    );

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------
    constructor() public {
        version = 2;

        // default token reward of 100 tokens.
        // token has 18 decimal places so that's why 100 * 10^18
        tokenReward = 100 * 10**18;

        // default saleFee of 10%
        saleFee = 10;

        // 604,800 seconds = 1 week.  this is the default for when a user started using an api (1 week ago)
        defaultBuyerLastPaidAt = 604800;

        // default withdrawAddress is owner
        withdrawAddress = msg.sender;
        usageReportingAddress = msg.sender;
    }

    // ------------------------------------------------------------------------
    // Owner can transfer out any accidentally sent ERC20 tokens (just in case)
    // ------------------------------------------------------------------------
    function transferAnyERC20Token(address tokenAddress, uint tokens) public onlyOwner returns (bool success) {
        return ERC20(tokenAddress).transfer(owner, tokens);
    }

    // ------------------------------------------------------------------------
    // Owner can transfer out any ETH
    // ------------------------------------------------------------------------
    function withdrawEther(uint amount) public {
        require(msg.sender == withdrawAddress);
        require(amount <= this.balance);
        require(amount <= safeWithdrawAmount);
        safeWithdrawAmount = safeWithdrawAmount.sub(amount);
        withdrawAddress.transfer(amount);
    }

    // ------------------------------------------------------------------------
    // Owner can set address of who can withdraw
    // ------------------------------------------------------------------------
    function setWithdrawAddress(address _withdrawAddress) public onlyOwner {
        require(_withdrawAddress != address(0));
        withdrawAddress = _withdrawAddress;
    }

    // ------------------------------------------------------------------------
    // Owner can set address of who can report usage
    // ------------------------------------------------------------------------
    function setUsageReportingAddress(address _usageReportingAddress) public onlyOwner {
        require(_usageReportingAddress != address(0));
        usageReportingAddress = _usageReportingAddress;
    }

    // ------------------------------------------------------------------------
    // Owner can set address of relay contract
    // ------------------------------------------------------------------------
    function setRelayContractAddress(address _relayContractAddress) public onlyOwner {
        require(_relayContractAddress != address(0));
        relayContractAddress = _relayContractAddress;
    }

    // ------------------------------------------------------------------------
    // Owner can set address of token contract
    // ------------------------------------------------------------------------
    function setTokenContractAddress(address _tokenContractAddress) public onlyOwner {
        require(_tokenContractAddress != address(0));
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
    // Owner can set the default buyer last paid at
    // ------------------------------------------------------------------------
    function setDefaultBuyerLastPaidAt(uint _defaultBuyerLastPaidAt) public onlyOwner {
        defaultBuyerLastPaidAt = _defaultBuyerLastPaidAt;
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

        // make sure the api is actually valid
        require(sellerUsername != "" && apiName != "");

        uint totalPrice = pricePerCall.mul(numCalls);

        require(totalPrice > 0);

        APIBalance storage apiBalance = owed[apiId];

        if (apiBalance.amounts[buyerAddress] == 0) {
            // add buyerAddress to list of addresses with nonzero balance for this api
            apiBalance.nonzeroAddressesPosition[buyerAddress] = apiBalance.nonzeroAddresses.length;
            apiBalance.nonzeroAddresses.push(buyerAddress);
        }

        apiBalance.amounts[buyerAddress] = apiBalance.amounts[buyerAddress].add(totalPrice);

        emit LogAPICallsMade(
            apiId,
            sellerAddress,
            buyerAddress,
            pricePerCall,
            numCalls,
            totalPrice,
            msg.sender
        );
    }

    // ------------------------------------------------------------------------
    // Function to pay the seller for a single API buyer.
    // Settles reported usage according to credits and approved amounts.
    // ------------------------------------------------------------------------
    function paySellerForBuyer(uint apiId, address buyerAddress) public {
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

        uint buyerPaid = processSalesForSingleBuyer(apiId, buyerAddress);

        if (buyerPaid == 0) {
            return; // buyer paid nothing, we are done.
        }

        // calculate fee and payout
        uint fee = buyerPaid.mul(saleFee).div(100);
        uint payout = buyerPaid.sub(fee);

        // log that we stored the fee so we know we can take it out later
        safeWithdrawAmount += fee;

        emit LogAPICallsPaid(
            apiId,
            sellerAddress,
            buyerPaid,
            tokenReward,
            fee
        );

        // give seller some tokens for the sale
        rewardTokens(sellerAddress, tokenReward);

        // transfer seller the eth
        sellerAddress.transfer(payout);
    }

    // ------------------------------------------------------------------------
    // Function to pay the seller for all buyers with nonzero balance.
    // Settles reported usage according to credits and approved amounts.
    // ------------------------------------------------------------------------
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
        uint totalPayable = 0;
        uint totalBuyers = 0;
        (totalPayable, totalBuyers) = processSalesForAllBuyers(apiId);

        if (totalPayable == 0) {
            return; // if there's nothing to pay, we are done here.
        }

        // calculate fee and payout
        uint fee = totalPayable.mul(saleFee).div(100);
        uint payout = totalPayable.sub(fee);

        // log that we stored the fee so we know we can take it out later
        safeWithdrawAmount += fee;

        // we reward token reward on a "per buyer" basis.  so multiply the reward to give by the number of actual buyers
        uint totalTokenReward = tokenReward.mul(totalBuyers);

        emit LogAPICallsPaid(
            apiId,
            sellerAddress,
            totalPayable,
            totalTokenReward,
            fee
        );

        // give seller some tokens for the sale
        rewardTokens(sellerAddress, totalTokenReward);

        // transfer seller the eth
        sellerAddress.transfer(payout);
    }

    // ------------------------------------------------------------------------
    // Let anyone see when the buyer last paid for a given API
    // ------------------------------------------------------------------------
    function buyerLastPaidAt(uint apiId, address buyerAddress) public view returns (uint) {
        APIBalance storage apiBalance = owed[apiId];
        return apiBalance.buyerLastPaidAt[buyerAddress];
    }

    // ------------------------------------------------------------------------
    // Get buyer info struct for a specific buyer address
    // ------------------------------------------------------------------------
    function buyerInfoOf(address addr)
        public
        view
        returns (
            bool overdrafted,
            uint lifetimeOverdraftCount,
            uint credits,
            uint lifetimeCreditsUsed,
            uint lifetimeExceededApprovalAmountCount
        )
    {
        BuyerInfo storage buyer = buyers[addr];
        overdrafted = buyer.overdrafted;
        lifetimeOverdraftCount = buyer.lifetimeOverdraftCount;
        credits = buyer.credits;
        lifetimeCreditsUsed = buyer.lifetimeCreditsUsed;
        lifetimeExceededApprovalAmountCount = buyer.lifetimeExceededApprovalAmountCount;
    }

    // ------------------------------------------------------------------------
    // Gets the credits balance of a buyer
    // ------------------------------------------------------------------------
    function creditsBalanceOf(address addr) public view returns (uint) {
        BuyerInfo storage buyer = buyers[addr];
        return buyer.credits;
    }

    // ------------------------------------------------------------------------
    // Lets a buyer add credits
    // ------------------------------------------------------------------------
    function addCredits(address to) public payable {
        BuyerInfo storage buyer = buyers[to];
        buyer.credits = buyer.credits.add(msg.value);
        emit LogDepositCredits(to, msg.value);
    }

    // ------------------------------------------------------------------------
    // Lets a buyer withdraw credits
    // ------------------------------------------------------------------------
    function withdrawCredits(uint amount) public {
        BuyerInfo storage buyer = buyers[msg.sender];
        require(buyer.credits >= amount);
        buyer.credits = buyer.credits.sub(amount);
        msg.sender.transfer(amount);
        emit LogWithdrawCredits(msg.sender, amount);
    }

    // ------------------------------------------------------------------------
    // Get the length of array of buyers who have a nonzero balance for a given API
    // ------------------------------------------------------------------------
    function nonzeroAddressesElementForApi(uint apiId, uint index) public view returns (address) {
        APIBalance storage apiBalance = owed[apiId];
        return apiBalance.nonzeroAddresses[index];
    }

    // ------------------------------------------------------------------------
    // Get an element from the array of buyers who have a nonzero balance for a given API
    // ------------------------------------------------------------------------
    function nonzeroAddressesLengthForApi(uint apiId) public view returns (uint) {
        APIBalance storage apiBalance = owed[apiId];
        return apiBalance.nonzeroAddresses.length;
    }

    // ------------------------------------------------------------------------
    // Get the amount owed for a specific api for a specific buyer
    // ------------------------------------------------------------------------
    function amountOwedForApiForBuyer(uint apiId, address buyerAddress) public view returns (uint) {
        APIBalance storage apiBalance = owed[apiId];
        return apiBalance.amounts[buyerAddress];
    }

    // ------------------------------------------------------------------------
    // Get the total owed for an entire api for all nonzero buyers
    // ------------------------------------------------------------------------
    function totalOwedForApi(uint apiId) public view returns (uint) {
        APIBalance storage apiBalance = owed[apiId];

        uint totalOwed = 0;
        for (uint i = 0; i < apiBalance.nonzeroAddresses.length; i++) {
            address buyerAddress = apiBalance.nonzeroAddresses[i];
            uint buyerOwes = apiBalance.amounts[buyerAddress];
            totalOwed = totalOwed.add(buyerOwes);
        }

        return totalOwed;
    }

    // ------------------------------------------------------------------------
    // Gets the amount of wei per second a buyer has approved for a specific api
    // ------------------------------------------------------------------------
    function approvedAmount(uint apiId, address buyerAddress) public view returns (uint) {
        return buyers[buyerAddress].approvedAmounts[apiId];
    }

    // ------------------------------------------------------------------------
    // Let the buyer set an approved amount of wei per second for a specific api
    // ------------------------------------------------------------------------
    function approveAmount(uint apiId, address buyerAddress, uint newAmount) public {
        require(buyerAddress != address(0) && apiId != 0);

        // only the buyer or the usage reporing system can change the buyers approval amount
        require(msg.sender == buyerAddress || msg.sender == usageReportingAddress);

        BuyerInfo storage buyer = buyers[buyerAddress];
        buyer.approvedAmounts[apiId] = newAmount;
    }

    // ------------------------------------------------------------------------
    // function to let the buyer set their approved amount of wei per second for an api
    // this function also lets the buyer set the time they last paid for an API if they've never paid that API before.
    // this is important because the total amount approved for a given transaction is based on a wei per second spending limit
    // but the smart contract doesn't know when the buyer started using the API
    // so with this function, a buyer can et the time they first used the API and the approved amount calculations will be accurate when the seller requests payment.
    // ------------------------------------------------------------------------
    function approveAmountAndSetFirstUseTime(
        uint apiId,
        address buyerAddress,
        uint newAmount,
        uint firstUseTime
    )
        public
    {
        require(buyerAddress != address(0) && apiId != 0);

        // only the buyer or the usage reporing system can change the buyers approval amount
        require(msg.sender == buyerAddress || msg.sender == usageReportingAddress);

        APIBalance storage apiBalance = owed[apiId];
        require(apiBalance.buyerLastPaidAt[buyerAddress] == 0);

        apiBalance.buyerLastPaidAt[buyerAddress] = firstUseTime;

        BuyerInfo storage buyer = buyers[buyerAddress];
        buyer.approvedAmounts[apiId] = newAmount;

    }

    // ------------------------------------------------------------------------
    // Gets whether or not a buyer exceeded their approved amount in the last seller payout
    // ------------------------------------------------------------------------
    function buyerExceededApprovedAmount(uint apiId, address buyerAddress) public view returns (bool) {
        return buyers[buyerAddress].exceededApprovedAmount[apiId];
    }

    // ------------------------------------------------------------------------
    // Reward user with tokens IF the contract has them in it's allowance
    // ------------------------------------------------------------------------
    function rewardTokens(address toReward, uint amount) private {
        DeconetToken token = DeconetToken(tokenContractAddress);
        address tokenOwner = token.owner();

        // check balance of tokenOwner
        uint tokenOwnerBalance = token.balanceOf(tokenOwner);
        uint tokenOwnerAllowance = token.allowance(tokenOwner, address(this));
        if (tokenOwnerBalance >= amount && tokenOwnerAllowance >= amount) {
            token.transferFrom(tokenOwner, toReward, amount);
        }
    }

    // ------------------------------------------------------------------------
    // Process and settle balances for a single buyer for a specific api
    // ------------------------------------------------------------------------
    function processSalesForSingleBuyer(uint apiId, address buyerAddress) private returns (uint) {
        APIBalance storage apiBalance = owed[apiId];

        uint buyerOwes = apiBalance.amounts[buyerAddress];
        uint buyerLastPaidAtTime = apiBalance.buyerLastPaidAt[buyerAddress];
        if (buyerLastPaidAtTime == 0) {
            // if buyer has never paid, assume they paid a week ago.  or whatever now - defaultBuyerLastPaidAt is.
            buyerLastPaidAtTime = now - defaultBuyerLastPaidAt; // default is 604,800 = 7 days of seconds
        }
        uint elapsedSecondsSinceLastPayout = now - buyerLastPaidAtTime;
        uint buyerNowOwes = buyerOwes;
        uint buyerPaid = 0;
        bool overdrafted = false;

        (buyerPaid, overdrafted) = chargeBuyer(apiId, buyerAddress, elapsedSecondsSinceLastPayout, buyerOwes);

        buyerNowOwes = buyerOwes.sub(buyerPaid);
        apiBalance.amounts[buyerAddress] = buyerNowOwes;

        // if the buyer now owes zero, then remove them from nonzeroAddresses
        if (buyerNowOwes == 0) {
            removeAddressFromNonzeroBalancesArray(apiId, buyerAddress);
        }
        // if the buyer paid nothing, we are done here.
        if (buyerPaid == 0) {
            return 0;
        }

        // log the event
        emit LogSpendCredits(buyerAddress, apiId, buyerPaid, overdrafted);

        // log that they paid
        apiBalance.buyerLastPaidAt[buyerAddress] = now;

        return buyerPaid;
    }

    // ------------------------------------------------------------------------
    // Process and settle balances for all buyers with a nonzero balance for a specific api
    // ------------------------------------------------------------------------
    function processSalesForAllBuyers(uint apiId) private returns (uint totalPayable, uint totalBuyers) {
        APIBalance storage apiBalance = owed[apiId];

        uint currentTime = now;
        address[] memory oldNonzeroAddresses = apiBalance.nonzeroAddresses;
        apiBalance.nonzeroAddresses = new address[](0);

        for (uint i = 0; i < oldNonzeroAddresses.length; i++) {
            address buyerAddress = oldNonzeroAddresses[i];
            uint buyerOwes = apiBalance.amounts[buyerAddress];
            uint buyerLastPaidAtTime = apiBalance.buyerLastPaidAt[buyerAddress];
            if (buyerLastPaidAtTime == 0) {
                // if buyer has never paid, assume they paid a week ago.  or whatever now - defaultBuyerLastPaidAt is.
                buyerLastPaidAtTime = now - defaultBuyerLastPaidAt; // default is 604,800 = 7 days of seconds
            }
            uint elapsedSecondsSinceLastPayout = currentTime - buyerLastPaidAtTime;
            uint buyerNowOwes = buyerOwes;
            uint buyerPaid = 0;
            bool overdrafted = false;

            (buyerPaid, overdrafted) = chargeBuyer(apiId, buyerAddress, elapsedSecondsSinceLastPayout, buyerOwes);

            totalPayable = totalPayable.add(buyerPaid);
            buyerNowOwes = buyerOwes.sub(buyerPaid);
            apiBalance.amounts[buyerAddress] = buyerNowOwes;

            // if the buyer still owes something, make sure we keep them in the nonzeroAddresses array
            if (buyerNowOwes != 0) {
                apiBalance.nonzeroAddressesPosition[buyerAddress] = apiBalance.nonzeroAddresses.length;
                apiBalance.nonzeroAddresses.push(buyerAddress);
            }
            // if the buyer paid more than 0, log the spend.
            if (buyerPaid != 0) {
                // log the event
                emit LogSpendCredits(buyerAddress, apiId, buyerPaid, overdrafted);

                // log that they paid
                apiBalance.buyerLastPaidAt[buyerAddress] = now;

                // add to total buyer count
                totalBuyers += 1;
            }
        }
    }

    // ------------------------------------------------------------------------
    // given a specific buyer, api, and the amount they owe, we need to figure out how much to pay
    // the final amount paid is based on the chart below:
    // if credits >= approved >= owed then pay owed
    // if credits >= owed > approved then pay approved and mark as exceeded approved amount
    // if owed > credits >= approved then pay approved and mark as overdrafted
    // if owed > approved > credits then pay credits and mark as overdrafted
    // ------------------------------------------------------------------------
    function chargeBuyer(
        uint apiId,
        address buyerAddress,
        uint elapsedSecondsSinceLastPayout,
        uint buyerOwes
    )
        private
        returns (
            uint paid,
            bool overdrafted
        )
    {
        BuyerInfo storage buyer = buyers[buyerAddress];
        uint approvedAmountPerSecond = buyer.approvedAmounts[apiId];
        uint approvedAmountSinceLastPayout = approvedAmountPerSecond.mul(elapsedSecondsSinceLastPayout);

        // do we have the credits to pay owed?
        if (buyer.credits >= buyerOwes) {
            // yay, buyer can pay their debits
            overdrafted = false;
            buyer.overdrafted = false;

            // has buyer approved enough to pay what they owe?
            if (approvedAmountSinceLastPayout >= buyerOwes) {
                // approved is greater than owed.
                // mark as not exceeded approved amount
                buyer.exceededApprovedAmount[apiId] = false;

                // we can pay the entire debt
                paid = buyerOwes;

            } else {
                // they have no approved enough
                // mark as exceeded
                buyer.exceededApprovedAmount[apiId] = true;
                buyer.lifetimeExceededApprovalAmountCount += 1;

                // we can only pay the approved portion of the debt
                paid = approvedAmountSinceLastPayout;
            }
        } else {
            // buyer spent more than they have.  mark as overdrafted
            overdrafted = true;
            buyer.overdrafted = true;
            buyer.lifetimeOverdraftCount += 1;

            // does buyer have more credits than the amount they've approved?
            if (buyer.credits >= approvedAmountSinceLastPayout) {
                // they have enough credits to pay approvedAmountSinceLastPayout, so pay that
                paid = approvedAmountSinceLastPayout;

            } else {
                // the don't have enough credits to pay approvedAmountSinceLastPayout
                // so just pay whatever credits they have
                paid = buyer.credits;
            }
        }

        buyer.credits = buyer.credits.sub(paid);
        buyer.lifetimeCreditsUsed = buyer.lifetimeCreditsUsed.add(paid);
    }

    function removeAddressFromNonzeroBalancesArray(uint apiId, address toRemove) private {
        APIBalance storage apiBalance = owed[apiId];
        uint position = apiBalance.nonzeroAddressesPosition[toRemove];
        if (position < apiBalance.nonzeroAddresses.length && apiBalance.nonzeroAddresses[position] == toRemove) {
            apiBalance.nonzeroAddresses[position] = apiBalance.nonzeroAddresses[apiBalance.nonzeroAddresses.length - 1];
            apiBalance.nonzeroAddresses.length--;
        }
    }
}
