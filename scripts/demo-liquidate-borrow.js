// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers } = require("hardhat");
require('dotenv').config();
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // Get contract owner & liquidator address
  const admin = (await ethers.getSigners())[0]
  const liquidator = (await ethers.getSigners())[1]
  //console.log(`admin: ${admin.address}`)

  ///////////////////////
  // Setup Comptroller //
  ///////////////////////

  let comptroller = await ethers.getContractAt("Comptroller", process.env.RINKEBY_COMPTROLLER_ADDR);
  const unitroller = await ethers.getContractAt("Unitroller", process.env.RINKEBY_UNITROLLER_ADDR);
  comptroller = comptroller.attach(unitroller.address)
  console.log(`comptroller setup: ${comptroller.address}`)

  /////////////////////////
  // Setup Token markets //
  /////////////////////////

  const cEth = await ethers.getContractAt("CEther", process.env.RINKEBY_CETH_ADDR);
  console.log(`cETH address ${cEth.address}`);

  const cTT = await ethers.getContractAt("CErc20Delegator",  process.env.RINKEBY_CTT_DELEGATOR_ADDR);
  console.log(`CTT address: ${cTT.address}`)

  /////////////////////////
  // Set cTT Price //
  /////////////////////////

  const simplePriceOracle = await ethers.getContractAt("SimplePriceOracle", process.env.RINKEBY_PRICEORACLE_ADDR);
  console.log(`Price Oracle contracts: ${simplePriceOracle.address}`)

  let ethPrice = await simplePriceOracle.getUnderlyingPrice(cEth.address);
  console.log(`ETH/USD Price: ${ethPrice/(10**18)}`);

  ////////////////////////
  // Liquidate Borrower //
  ////////////////////////

  let cTTAccountSnapshot = await cTT.connect(admin).callStatic.getAccountSnapshot(admin.address)
  console.log(`----------Borrower before liquidation----------`)
  cTTAccountSnapshot = await cTT.connect(admin).callStatic.getAccountSnapshot(admin.address)
  console.log(`Borrowed TT: ${cTTAccountSnapshot[2]/(10**18)}`);      //0.2
  console.log(`cTT ExchangeRate: ${cTTAccountSnapshot[3]/(10**18)}`); //1

  liquidity = await comptroller.callStatic.getAccountLiquidity(admin.address);
  console.log(`liquidity: ${liquidity[1]/(10**18)}`); //480
  console.log(`shortfall: ${liquidity[2]/(10**18)}`); //0

  // Adjust price, make liquidity < 0
  tx = await simplePriceOracle.setUnderlyingPrice(cEth.address, ethers.utils.parseEther("300"));
  await tx.wait();
  ethPrice = await simplePriceOracle.getUnderlyingPrice(cEth.address);
  console.log(`Half ETH/USD Price: ${ethPrice/(10**18)}`); //300

  liquidity = await comptroller.callStatic.getAccountLiquidity(admin.address);
  console.log(`latest liquidity: ${liquidity[1]/(10**18)}`); //0
  console.log(`latest shortfall: ${liquidity[2]/(10**18)}`); //60

  // Approve Test Token transfer - liquidator
  const tt = await ethers.getContractAt("TestToken", process.env.RINKEBY_TT_ADDR);
  tx = await tt.connect(liquidator).approve(cTT.address, ethers.utils.parseEther('10000000'))
  console.log(`Approve liquidator's TT`)

  // Make sure liquidator has enough Test Token
  let ttBalance = await tt.callStatic.balanceOf(liquidator.address)
  console.log(`Liquidator TT Balance: ${ttBalance/(10**18)}`); //~5

  // Liquidate borrower
  tx = await cTT.connect(liquidator).liquidateBorrow(admin.address, ethers.utils.parseEther("0.03"), cEth.address);
  await tx.wait()

  console.log(`-------Borrower after 0.03 CTT liquidation-------`)
  liquidity = await comptroller.callStatic.getAccountLiquidity(admin.address);
  console.log(`latest liquidity: ${liquidity[1]/(10**18)}`); //~30
  console.log(`latest shortfall: ${liquidity[2]/(10**18)}`); //0

  cTTAccountSnapshot = await cTT.connect(admin).callStatic.getAccountSnapshot(admin.address)
  console.log(`Borrowed TT: ${cTTAccountSnapshot[2]/(10**18)}`); //~0.17

  ttBalance = await tt.callStatic.balanceOf(liquidator.address)
  console.log(`Liquidator TT Balance: ${ttBalance/(10**18)}`); //~4.7
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });