pragma solidity 0.4.24;
// produced by the Solididy File Flattener (c) David Appleton 2018
// contact : dave@akomba.com
// released under Apache 2.0 licence
contract DeconetToken is StandardToken, Ownable, Pausable {
    // token naming etc
    string public constant symbol = "DCO";
    string public constant name = "Deconet Token";
    uint8 public constant decimals = 18;

    // contract version
    uint public constant version = 4;

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------
    constructor() public {
        // 1 billion tokens (1,000,000,000)
        totalSupply_ = 1000000000 * 10**uint(decimals);

        // transfer initial supply to msg.sender who is also contract owner
        balances[msg.sender] = totalSupply_;
        Transfer(address(0), msg.sender, totalSupply_);

        // pause contract until we're ready to allow transfers
        paused = true;
    }

    // ------------------------------------------------------------------------
    // Owner can transfer out any accidentally sent ERC20 tokens (just in case)
    // ------------------------------------------------------------------------
    function transferAnyERC20Token(address tokenAddress, uint tokens) public onlyOwner returns (bool success) {
        return ERC20(tokenAddress).transfer(owner, tokens);
    }

    // ------------------------------------------------------------------------
    // Modifier to make a function callable only when called by the contract owner
    // or if the contract is not paused.
    // ------------------------------------------------------------------------
    modifier whenOwnerOrNotPaused() {
        require(msg.sender == owner || !paused);
        _;
    }

    // ------------------------------------------------------------------------
    // overloaded openzepplin method to add whenOwnerOrNotPaused modifier
    // ------------------------------------------------------------------------
    function transfer(address _to, uint256 _value) public whenOwnerOrNotPaused returns (bool) {
        return super.transfer(_to, _value);
    }

    // ------------------------------------------------------------------------
    // overloaded openzepplin method to add whenOwnerOrNotPaused modifier
    // ------------------------------------------------------------------------
    function transferFrom(address _from, address _to, uint256 _value) public whenOwnerOrNotPaused returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }

    // ------------------------------------------------------------------------
    // overloaded openzepplin method to add whenOwnerOrNotPaused modifier
    // ------------------------------------------------------------------------
    function approve(address _spender, uint256 _value) public whenOwnerOrNotPaused returns (bool) {
        return super.approve(_spender, _value);
    }

    // ------------------------------------------------------------------------
    // overloaded openzepplin method to add whenOwnerOrNotPaused modifier
    // ------------------------------------------------------------------------
    function increaseApproval(address _spender, uint _addedValue) public whenOwnerOrNotPaused returns (bool success) {
        return super.increaseApproval(_spender, _addedValue);
    }

    // ------------------------------------------------------------------------
    // overloaded openzepplin method to add whenOwnerOrNotPaused modifier
    // ------------------------------------------------------------------------
    function decreaseApproval(address _spender, uint _subtractedValue) public whenOwnerOrNotPaused returns (bool success) {
        return super.decreaseApproval(_spender, _subtractedValue);
    }
}

