pragma solidity ^0.5.16;

import "./PriceOracle.sol";
import "./CErc20.sol";
import "@chainlink/contracts/src/v0.5/interfaces/AggregatorV3Interface.sol";

contract MyChainLinkPriceOracle is PriceOracle {
    mapping(address => uint) prices;
    event PricePosted(address asset, uint previousPriceMantissa, uint requestedPriceMantissa, uint newPriceMantissa);

    /// @notice ChainLink token address & datafeed address
    mapping(address => address) public aggregators;
    bool public testMode = false;

    function setTestMode(bool isTest) public {
        testMode = isTest;
    }

    function _getUnderlyingAddress(CToken cToken) private view returns (address) {
        address asset;
        if (compareStrings(cToken.symbol(), "cETH")) {
            asset = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
        } else {
            asset = address(CErc20(address(cToken)).underlying());
        }
        return asset;
    }

    function getUnderlyingPrice(CToken cToken) public view returns (uint) {
        address underlyingToken = _getUnderlyingAddress(cToken);
        if (testMode)
            return prices[underlyingToken];
        else
            return _getPriceFromChainlink(aggregators[underlyingToken]);
    }

    function getDataFeedAddr(CToken cToken) public view returns (address) {
        address underlyingToken = _getUnderlyingAddress(cToken);
        return aggregators[underlyingToken];
    }

    /**
     * @notice Get price from ChainLink, quote is ETH
     * @param datafeed The base/quote token that ChainLink aggregator gets the price of
     * @return The price, scaled by 1e18
     */
    function _getPriceFromChainlink(address datafeed) public view returns (uint256) {
        (, int256 price, , , ) = AggregatorV3Interface(datafeed).latestRoundData();
        require(price > 0, "invalid price");
        return uint256(price) * 10**10;
    }

    /**
     * @notice Set ChainLink aggregators for multiple tokens
     * @param tokenAddresses The list of underlying tokens
     * @param datafeed The list of ChainLink datafeed aggregator
     */
    function _setAggregators(address[] calldata tokenAddresses, address[] calldata datafeed) external {
        require(tokenAddresses.length == datafeed.length, "mismatched data");
        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            aggregators[tokenAddresses[i]] = datafeed[i];
        }
    }

    function setUnderlyingPrice(CToken cToken, uint underlyingPriceMantissa) public {
        address asset = _getUnderlyingAddress(cToken);
        emit PricePosted(asset, prices[asset], underlyingPriceMantissa, underlyingPriceMantissa);
        prices[asset] = underlyingPriceMantissa;
    }

    // v1 price oracle interface for use as backing of proxy
    function assetPrices(address asset) external view returns (uint) {
        return prices[asset];
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }
}
