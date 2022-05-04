// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
require('dotenv').config();
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
const { BigNumber } = ethers;

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // Get contract owner & liquidator address
  const admin = (await ethers.getSigners())[0];
  console.log("Admin address: ", admin.address);

  console.log("==================== Comptroller Settings ====================")

  let comptroller = await ethers.getContractAt("Comptroller", process.env.KOVAN_COMPTROLLER_ADDR);
  // const unitroller = await ethers.getContractAt("Unitroller", process.env.KOVAN_UNITROLLER_ADDR);
  // comptroller = comptroller.attach(unitroller.address)
  console.log(`comptroller setup: ${comptroller.address}`)

  // const simplePriceOracle = await ethers.getContractAt("SimplePriceOracle", process.env.KOVAN_PRICEORACLE_ADDR);
  // console.log(`Price Oracle contracts: ${simplePriceOracle.address}`)

  // tx = await comptroller._setPriceOracle(simplePriceOracle.address);
  // await tx.wait();
  // console.log(`set price oracle`);

  console.log("\n==================== CUSDC Market ====================")
  const cUsdc = await hre.ethers.getContractAt("CErc20Delegator", process.env.KOVAN_CUSDC_ADDR_COMP);
  console.log("cUSDC address:", cUsdc.address);

  const cUsdcName = await cUsdc.callStatic.name();
  const cUsdcSymbol = await cUsdc.callStatic.symbol();
  const cUsdcDecimals = await cUsdc.callStatic.decimals();
  console.log("Name:", cUsdcName, ", Symbol:", cUsdcSymbol, ", Decimals:", cUsdcDecimals);

  const cUsdcExchangeRate = await cUsdc.callStatic.exchangeRateCurrent();
  console.log("current exchange rate:", cUsdcExchangeRate.toString());

  let cUsdcTotalBorrow = await cUsdc.callStatic.totalBorrows();
  let cUsdcTotalSupply = await cUsdc.callStatic.totalSupply();
  let cUsdcCash = await cUsdc.callStatic.getCash();
  console.log("total borrows:", cUsdcTotalBorrow.toString());
  console.log("total supply:", cUsdcTotalSupply.toString());
  console.log("current cash:", cUsdcCash.toString());

  // console.log("\n==================== Manual setting up price ====================")
  // tx = await simplePriceOracle.setUnderlyingPrice(cUsdc.address, ethers.utils.parseEther("2"));
  // await tx.wait();
  // let usdcPrice = await simplePriceOracle.getUnderlyingPrice(cUsdc.address);
  // console.log(`USDC/USD Price: ${usdcPrice/(10**18)}`);

  console.log("\n==================== Approve USDC  ====================")
  const usdcAddress = await cUsdc.underlying();
  const ERC20ABI = require('./ERC20.json');
  const usdc = new ethers.Contract(usdcAddress, ERC20ABI, admin);
  console.log("USDC address:", usdc.address);

  const usdcName = await usdc.callStatic.name();
  const usdcSymbol = await usdc.callStatic.symbol();
  const usdcDecimals = await usdc.callStatic.decimals();
  console.log("Name:", usdcName, ", Symbol:", usdcSymbol, ", Decimals:", usdcDecimals);

  tx = await usdc.approve(cUsdc.address, ethers.utils.parseEther('10000000'), {gasLimit: 1000000})
  console.log(`Approve Usdc`)

  console.log("\n==================== Enter & Mint USDC 200  ====================")
  // tx = await comptroller.enterMarkets([cUsdc.address])
  // await tx.wait()

  // tx = await cUsdc.mint(BigNumber.from(200000000), {gasLimit: 1000000})
  // await tx.wait()
  // console.log(`mint cUsdc`)
  
  cUsdcBalance = await cUsdc.callStatic.balanceOf(admin.address)
  console.log("Entered CUSDC, CUSDC balance: ", cUsdcBalance.toString());
  let liquidity = await comptroller.callStatic.getAccountLiquidity(admin.address);
  console.log(`latest liquidity: ${liquidity[1]}`);
  console.log(`latest shortfall: ${liquidity[2]}`);

  console.log("\n==================== Borrow USDC 150 ====================")
  tx = await cUsdc.borrow(BigNumber.from(5000000), {gasLimit: 1000000});
  await tx.wait()
  let cUsdcAccountSnapshot = await cUsdc.callStatic.getAccountSnapshot(admin.address)
  console.log(`cUsdc Balance: ${cUsdcAccountSnapshot[1]}`);
  console.log(`Borrowed Usdc: ${cUsdcAccountSnapshot[2]}`);

  liquidity = await comptroller.callStatic.getAccountLiquidity(admin.address);
  console.log(`latest liquidity: ${liquidity[1]}`);
  console.log(`latest shortfall: ${liquidity[2]}`);

  // console.log("\n==================== USDC price drop ====================")
  // tx = await simplePriceOracle.setUnderlyingPrice(cUsdc.address, ethers.utils.parseEther("1"));
  // await tx.wait();
  // usdcPrice = await simplePriceOracle.getUnderlyingPrice(cUsdc.address);
  // console.log(`USDC/USD Price: ${usdcPrice/(10**18)}`);
  // liquidity = await comptroller.callStatic.getAccountLiquidity(admin.address);
  // console.log(`latest liquidity: ${liquidity[1]}`);
  // console.log(`latest shortfall: ${liquidity[2]}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
