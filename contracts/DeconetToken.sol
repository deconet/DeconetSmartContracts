pragma solidity ^0.4.19;

import "./Owned.sol";

// this is borrowed from the example fixed supply token contract, licensed below under the MIT License.
// ----------------------------------------------------------------------------
// 'FIXED' 'Example Fixed Supply Token' token contract
//
// Symbol      : FIXED
// Name        : Example Fixed Supply Token
// Total supply: 1,000,000.000000000000000000
// Decimals    : 18
//
// Enjoy.
//
// (c) BokkyPooBah / Bok Consulting Pty Ltd 2017. The MIT Licence.
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Safe maths
// ----------------------------------------------------------------------------
library SafeMath {
    function add(uint a, uint b) internal pure returns (uint c) {
        c = a + b;
        require(c >= a);
    }
    function sub(uint a, uint b) internal pure returns (uint c) {
        require(b <= a);
        c = a - b;
    }
    function mul(uint a, uint b) internal pure returns (uint c) {
        c = a * b;
        require(a == 0 || c / a == b);
    }
    function div(uint a, uint b) internal pure returns (uint c) {
        require(b > 0);
        c = a / b;
    }
}

// ----------------------------------------------------------------------------
// ERC Token Standard #20 Interface
// https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20-token-standard.md
// ----------------------------------------------------------------------------
contract ERC20Interface {
    function totalSupply() public constant returns (uint);
    function balanceOf(address tokenOwner) public constant returns (uint balance);
    function allowance(address tokenOwner, address spender) public constant returns (uint remaining);
    function transfer(address to, uint tokens) public returns (bool success);
    function approve(address spender, uint tokens) public returns (bool success);
    function transferFrom(address from, address to, uint tokens) public returns (bool success);

    event Transfer(address indexed from, address indexed to, uint tokens);
    event Approval(address indexed tokenOwner, address indexed spender, uint tokens);
}


// ----------------------------------------------------------------------------
// Contract function to receive approval and execute function in one call
//
// Borrowed from MiniMeToken
// ----------------------------------------------------------------------------
contract ApproveAndCallFallBack {
    function receiveApproval(address from, uint256 tokens, address token, bytes data) public;
}

// ----------------------------------------------------------------------------
// ERC20 Token, with the addition of symbol, name and decimals and an
// initial fixed supply
// ----------------------------------------------------------------------------
contract DeconetToken is ERC20Interface, Owned {
    using SafeMath for uint;

    struct Sale {
      string projectName;
      string sellerUsername;
      address sellerAddress;
      address buyerAddress;
      uint price;
    }

    string public symbol;
    string public  name;
    uint8 public decimals;
    uint public _totalSupply;

    // the amount rewarded to a seller for selling a license exception
    uint public tokenReward;

    // the fee this contract takes from every sale.  expressed as percent.  so a value of 3 indicated a 3% txn fee
    uint public saleFee;

    mapping(address => uint) balances;
    mapping(address => mapping(address => uint)) allowed;

    uint numSales;
    mapping(uint => Sale) sales;
    mapping(address => uint[]) buyerSales;
    mapping(address => uint[]) sellerSales;

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------
    function DeconetToken() public {
        symbol = "DCO";
        name = "Deconet Token";
        tokenReward = 100;
        decimals = 18;
        saleFee = 10;
        _totalSupply = 1000000000 * 10**uint(decimals);
        balances[owner] = _totalSupply;
        Transfer(address(0), owner, _totalSupply);
    }


    // ------------------------------------------------------------------------
    // Total supply
    // ------------------------------------------------------------------------
    function totalSupply() public constant returns (uint) {
        return _totalSupply  - balances[address(0)];
    }


    // ------------------------------------------------------------------------
    // Get the token balance for account `tokenOwner`
    // ------------------------------------------------------------------------
    function balanceOf(address tokenOwner) public constant returns (uint balance) {
        return balances[tokenOwner];
    }


    // ------------------------------------------------------------------------
    // Transfer the balance from token owner's account to `to` account
    // - Owner's account must have sufficient balance to transfer
    // - 0 value transfers are allowed
    // ------------------------------------------------------------------------
    function transfer(address to, uint tokens) public returns (bool success) {
        balances[msg.sender] = balances[msg.sender].sub(tokens);
        balances[to] = balances[to].add(tokens);
        Transfer(msg.sender, to, tokens);
        return true;
    }


    // ------------------------------------------------------------------------
    // Token owner can approve for `spender` to transferFrom(...) `tokens`
    // from the token owner's account
    //
    // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20-token-standard.md
    // recommends that there are no checks for the approval double-spend attack
    // as this should be implemented in user interfaces 
    // ------------------------------------------------------------------------
    function approve(address spender, uint tokens) public returns (bool success) {
        allowed[msg.sender][spender] = tokens;
        Approval(msg.sender, spender, tokens);
        return true;
    }


    // ------------------------------------------------------------------------
    // Transfer `tokens` from the `from` account to the `to` account
    // 
    // The calling account must already have sufficient tokens approve(...)-d
    // for spending from the `from` account and
    // - From account must have sufficient balance to transfer
    // - Spender must have sufficient allowance to transfer
    // - 0 value transfers are allowed
    // ------------------------------------------------------------------------
    function transferFrom(address from, address to, uint tokens) public returns (bool success) {
        balances[from] = balances[from].sub(tokens);
        allowed[from][msg.sender] = allowed[from][msg.sender].sub(tokens);
        balances[to] = balances[to].add(tokens);
        Transfer(from, to, tokens);
        return true;
    }


    // ------------------------------------------------------------------------
    // Returns the amount of tokens approved by the owner that can be
    // transferred to the spender's account
    // ------------------------------------------------------------------------
    function allowance(address tokenOwner, address spender) public constant returns (uint remaining) {
        return allowed[tokenOwner][spender];
    }


    // ------------------------------------------------------------------------
    // Token owner can approve for `spender` to transferFrom(...) `tokens`
    // from the token owner's account. The `spender` contract function
    // `receiveApproval(...)` is then executed
    // ------------------------------------------------------------------------
    function approveAndCall(address spender, uint tokens, bytes data) public returns (bool success) {
        allowed[msg.sender][spender] = tokens;
        Approval(msg.sender, spender, tokens);
        ApproveAndCallFallBack(spender).receiveApproval(msg.sender, tokens, this, data);
        return true;
    }

    // ------------------------------------------------------------------------
    // Owner can transfer out any accidentally sent ERC20 tokens
    // ------------------------------------------------------------------------
    function transferAnyERC20Token(address tokenAddress, uint tokens) public onlyOwner returns (bool success) {
        return ERC20Interface(tokenAddress).transfer(owner, tokens);
    }

    function makeSale(string projectName, string sellerUsername, address sellerAddress, uint price) public payable {
      // log the sale
      uint saleID = numSales++;
      sales[saleID] = Sale({
        projectName: projectName,
        sellerUsername: sellerUsername,
        sellerAddress: sellerAddress,
        buyerAddress: msg.sender,
        price: price
      });
      buyerSales[msg.sender].push(saleID);
      sellerSales[sellerAddress].push(saleID);

      // pay seller the ETH
      // fixed point math at 2 decimal places
      uint payout = msg.value.mul(100).div(saleFee).div(100);
      sellerAddress.transfer(payout);

      // give seller some tokens for the sale as well
      balances[owner] = balances[owner].sub(tokenReward);
      balances[sellerAddress] = balances[sellerAddress].add(tokenReward);
      Transfer(owner, sellerAddress, tokenReward);
    }

    function getSaleCountForBuyer(address buyer) public view returns (uint) {
      return buyerSales[buyer].length;
    }

    function getSaleForBuyerAtIndex(address buyer, uint index) public view returns (string, string, address, address, uint) {
      uint saleID = buyerSales[buyer][index];
      return (
        sales[saleID].projectName,
        sales[saleID].sellerUsername,
        sales[saleID].sellerAddress,
        sales[saleID].buyerAddress,
        sales[saleID].price
      );
    }

    function getSaleCountForSeller(address seller) public view returns (uint) {
      return sellerSales[seller].length;
    }

    function getSaleForSellerAtIndex(address seller, uint index) public view returns (string, string, address, address, uint) {
      uint saleID = sellerSales[seller][index];
      return (
        sales[saleID].projectName,
        sales[saleID].sellerUsername,
        sales[saleID].sellerAddress,
        sales[saleID].buyerAddress,
        sales[saleID].price
      );
    }
}