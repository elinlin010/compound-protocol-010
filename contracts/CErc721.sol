// transferin NFT, mint CEther, amount by priceoracle -> mintinternal CEther amount
// 不用指定 token id
// 複製 CToken，接收 NFT

pragma solidity ^0.5.16;

import "./ERC721.sol";
import "./ErrorReporter.sol";
import "./ComptrollerInterface.sol";
import "./Exponential.sol";

/**
 * @title Compound's CErc721 Contract
 * @notice CTokens which wrap an EIP-721 underlying
 * @author AppRowrks School - 010
 */

 /** Implement the following interfaces
    For ERC-721 standards:
    function safeTransferFrom(address from, address to, uint256 tokenId) public;
    function approve(address to, uint256 tokenId) public;
    function balanceOf(address owner) external view returns (uint);
    function ownerOf(uint256 tokenId) public view returns (address owner);

    For CToken core actions
    function getAccountSnapshot(address account) public view returns (uint, uint, uint);
    function mint(uint mintTokenId) external returns (uint);
    function redeem(uint redeemTokenId) external returns (uint);
    function seize(address liquidator, address borrower, uint seizeTokens) external returns (uint);
 */
contract CErc721 is ERC721, TokenErrorReporter, Exponential {
    /**
     * @dev Guard variable for re-entrancy checks
     */
    bool internal _notEntered;

    /**
     * @notice Indicator that this is a CToken contract (for inspection)
     */
    bool public constant isCToken = true;

    /**
     * @notice EIP-721 token name for this token
     */
    string public name;

    /**
     * @notice EIP-721 token symbol for this token
     */
    string public symbol;

    /**
     * @notice Administrator for this contract
     */
    address payable public admin;

    /**
     * @notice Contract which oversees inter-cToken operations
     */
    ComptrollerInterface public comptroller;

    /**
     * @notice Total number of tokens in circulation
     */
    uint public totalSupply;

    /**
     * @notice Underlying asset for this CToken
     */
    address public underlying;

    /**
     * @notice Event emitted when comptroller is changed
     */
    event NewComptroller(ComptrollerInterface oldComptroller, ComptrollerInterface newComptroller);

    /**
     * @notice Initialize the new money market
     * @param underlying_ The address of the underlying asset
     * @param comptroller_ The address of the Comptroller
     * @param name_ ERC-20 name of this token
     * @param symbol_ ERC-20 symbol of this token
     */
    constructor(address underlying_,
                ComptrollerInterface comptroller_,
                string memory name_,
                string memory symbol_) public {
        admin = msg.sender;

        // Set the comptroller
        uint err = _setComptroller(comptroller_);
        require(err == uint(Error.NO_ERROR), "setting comptroller failed");

        name = name_;
        symbol = symbol_;

        // The counter starts true to prevent changing it from zero to non-zero (i.e. smaller cost/refund)
        _notEntered = true;

        // Set underlying and sanity check it
        underlying = underlying_;
    }

    /*** User Interface ***/

    function getAccountSnapshot(address account) external view returns (uint, uint, uint, uint) {
        uint cTokenBalance = uint(balanceOf(account));

        return (uint(Error.NO_ERROR), cTokenBalance * 1e18, 0, 1e18);
    }

    /**
     * @notice Sender supplies assets into the market and receives cTokens in exchange
     * @dev Accrues interest whether or not the operation succeeds, unless reverted
     * @param mintTokenId The token ID of the underlying asset to supply
     * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function mint(uint mintTokenId) public {
        address minter = msg.sender;
    
        /* Fail if mint not allowed, mintAmount = 1 */
        // uint allowed = comptroller.mintAllowed(address(this), minter, 1);
        // if (allowed != 0) {
        //     return failOpaque(Error.COMPTROLLER_REJECTION, FailureInfo.MINT_COMPTROLLER_REJECTION, allowed);
        // }

        /////////////////////////
        // EFFECTS & INTERACTIONS
        // (No safe failures beyond this point)

        doTransferIn(minter, mintTokenId);

        MathError mathErr;
        uint totalSupplyNew;
        /*
         * We calculate the new total supply of cTokens and minter token balance, checking for overflow:
         *  totalSupplyNew = totalSupply + mintTokens
         */
        (mathErr, totalSupplyNew) = addUInt(totalSupply, 1);
        require(mathErr == MathError.NO_ERROR, "MINT_NEW_TOTAL_SUPPLY_CALCULATION_FAILED");

        totalSupply = totalSupplyNew;

        /* We emit a Mint event, and a Transfer event */
        // emit Mint721(minter, mintTokenId, index);
        emit Transfer(address(this), minter, mintTokenId);

        // return uint(Error.NO_ERROR);
    }

    /**
     * @notice Sender redeems cTokens in exchange for the underlying asset
     * @dev Accrues interest whether or not the operation succeeds, unless reverted
     * @param redeemTokenId The token ID of cTokens to redeem into underlying
     * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function redeem(uint redeemTokenId) public {
        address redeemer = msg.sender;

        /* Fail if redeem not allowed */
        // uint allowed = comptroller.redeemAllowed(address(this), redeemer, 1);
        // if (allowed != 0) {
        //     return failOpaque(Error.COMPTROLLER_REJECTION, FailureInfo.REDEEM_COMPTROLLER_REJECTION, allowed);
        // }

        /*
         * We calculate the new total supply and redeemer balance, checking for underflow:
         *  totalSupplyNew = totalSupply - redeemTokens
         */
        MathError mathErr;
        uint totalSupplyNew;

        (mathErr, totalSupplyNew) = subUInt(totalSupply, 1);
        // if (mathErr != MathError.NO_ERROR) {
        //     return failOpaque(Error.MATH_ERROR, FailureInfo.REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED, uint(mathErr));
        // }

        /////////////////////////
        // EFFECTS & INTERACTIONS
        // (No safe failures beyond this point)

        /*
         * We invoke doTransferOut for the redeemer and the redeemAmount.
         *  Note: The cToken must handle variations between ERC-20 and ETH underlying.
         *  On success, the cToken has redeemAmount less of cash.
         *  doTransferOut reverts if anything goes wrong, since we can't be sure if side effects occurred.
         */
        doTransferOut(redeemer, redeemTokenId);

        /* We write previously calculated values into storage */
        totalSupply = totalSupplyNew;

        /* We emit a Transfer event, and a Redeem event */
        emit Transfer(redeemer, address(this), redeemTokenId);
        // emit Redeem(redeemer, vars.redeemAmount, vars.redeemTokens);

        // return uint(Error.NO_ERROR);
    }

    function seize(address liquidator, address borrower, uint tokenId) public {
        doTransfer(borrower, liquidator, tokenId);
    }

    /*** Safe Token ***/

    /**
     * @dev Similar to EIP20 transfer, except it handles a False result from `transferFrom` and reverts in that case.
     *      This will revert due to insufficient balance or insufficient allowance.
     *      This function returns the actual tokenId received,
     *      which may be less than `amount` if there is a fee attached to the transfer.
     *
     *      Note: This wrapper safely handles non-standard ERC-20 tokens that do not return a value.
     *            See here: https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
     */
    function doTransferIn(address from, uint256 tokenId) internal {
        IERC721(underlying).transferFrom(from, address(this), tokenId);
        _safeMint(from, tokenId);
    }

    function doTransferOut(address to, uint256 tokenId) internal {
        doTransfer(to, address(this), tokenId);
        IERC721(underlying).transferFrom(address(this), to, tokenId);
    }

    function doTransfer(address from, address to, uint256 tokenId) internal {
        _transferFrom(from, to, tokenId);
    }

    /**
      * @notice Sets a new comptroller for the market
      * @dev Admin function to set a new comptroller
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setComptroller(ComptrollerInterface newComptroller) public returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_COMPTROLLER_OWNER_CHECK);
        }

        ComptrollerInterface oldComptroller = comptroller;
        // Ensure invoke comptroller.isComptroller() returns true
        require(newComptroller.isComptroller(), "marker method returned false");

        // Set market's comptroller to newComptroller
        comptroller = newComptroller;

        // Emit NewComptroller(oldComptroller, newComptroller)
        emit NewComptroller(oldComptroller, newComptroller);

        return uint(Error.NO_ERROR);
    }
}
