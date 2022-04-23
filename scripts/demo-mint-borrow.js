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

  // Get contract owner address
  admin = (await ethers.getSigners())[0]
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

  tx = await cEth._setReserveFactor(ethers.utils.parseEther('0.05'));
  await tx.wait();
  tx = await cTT._setReserveFactor(ethers.utils.parseEther('0.07'));
  await tx.wait();
  console.log(`Set Reserve Factor: CEth & CTT`)

  //////////////////////////////
  // Setup Token Price Oracle //
  //////////////////////////////

  const simplePriceOracle = await ethers.getContractAt("SimplePriceOracle", process.env.RINKEBY_PRICEORACLE_ADDR);
  console.log(`Price Oracle contracts: ${simplePriceOracle.address}`)
  
  tx = await simplePriceOracle.setUnderlyingPrice(cEth.address, ethers.utils.parseEther("3000"));
  await tx.wait();
  tx = await simplePriceOracle.setUnderlyingPrice(cTT.address, ethers.utils.parseEther("3000"));
  await tx.wait();

  let ethPrice = await simplePriceOracle.getUnderlyingPrice(cEth.address);
  console.log(`ETH/USD Price: ${ethPrice/(10**18)}`); //3000

  let ttPrice = await simplePriceOracle.getUnderlyingPrice(cTT.address);
  console.log(`TT/USD Price: ${ttPrice/(10**18)}`); //3000

  // Set price oracle in comptroller
  tx = await comptroller._setPriceOracle(simplePriceOracle.address)
  await tx.wait()

  ///////////////////////////
  // Support Token markets //
  ///////////////////////////

  tx = await comptroller._supportMarket(cEth.address)
  await tx.wait()
  console.log(`support CEth`)
  tx = await comptroller._supportMarket(cTT.address)
  await tx.wait()
  console.log(`support CTT`)

  tx = await comptroller.enterMarkets([cEth.address, cTT.address])
  await tx.wait()
  console.log(`Enter CEth & CTT`)

  tx = await comptroller._setCollateralFactor(cEth.address, ethers.utils.parseEther("0.8"));
  await tx.wait();
  console.log(`Set Collateral Factor: CEth`)

  tx = await comptroller._setCollateralFactor(cTT.address, ethers.utils.parseEther("0.8"));
  await tx.wait();
  console.log(`Set Collateral Factor: CTT`)

  tx = await comptroller._setCloseFactor(ethers.utils.parseEther("0.5"));
  await tx.wait();
  console.log(`Set Close Factor`)

  ///////////////////
  // Mint & Borrow //
  ///////////////////

  let cEThAccountSnapshot = await cEth.callStatic.getAccountSnapshot(admin.address)
  console.log(`----------Before----------`)
  console.log(`cEth Balance: ${cEThAccountSnapshot[1]/(10**18)}`);
  console.log(`Borrowed Eth: ${cEThAccountSnapshot[2]/(10**18)}`);
  console.log(`cEth ExchangeRate: ${cEThAccountSnapshot[3]/(10**18)}`);

  tx = await cEth.mint({value: ethers.utils.parseEther("0.25")})
  await tx.wait()
  console.log(`mint cETH`)

  console.log(`----------After Mint----------`)
  cEThAccountSnapshot = await cEth.callStatic.getAccountSnapshot(admin.address)
  console.log(`cEth Balance: ${cEThAccountSnapshot[1]/(10**18)}`);      //0.25
  console.log(`Borrowed Eth: ${cEThAccountSnapshot[2]/(10**18)}`);      //0
  console.log(`cEth ExchangeRate: ${cEThAccountSnapshot[3]/(10**18)}`); //1

  let cTTAccountSnapshot = await cTT.callStatic.getAccountSnapshot(admin.address)
  console.log(`----------Before----------`)
  console.log(`cTT Balance: ${cTTAccountSnapshot[1]/(10**18)}`);
  console.log(`Borrowed Test Tokens: ${cTTAccountSnapshot[2]/(10**18)}`);
  console.log(`cTT ExchangeRate: ${cTTAccountSnapshot[3]/(10**18)}`);

  const tt = await ethers.getContractAt("TestToken", process.env.RINKEBY_TT_ADDR);
  tx = await tt.approve(
    cTT.address,
    ethers.utils.parseEther('10000000')
  )
  await tx.wait()
  console.log(`Approve TT`)

  tx = await cTT.mint(ethers.utils.parseEther("0.2"))
  await tx.wait()
  console.log(`mint cTT`)

  console.log(`----------After Mint----------`)
  cTTAccountSnapshot = await cTT.callStatic.getAccountSnapshot(admin.address)
  console.log(`cTT Balance: ${cTTAccountSnapshot[1]/(10**18)}`);      //0.2
  console.log(`Borrowed TT: ${cTTAccountSnapshot[2]/(10**18)}`);      //0
  console.log(`cTT ExchangeRate: ${cTTAccountSnapshot[3]/(10**18)}`); //1
  
  // Enlarge Gas Limit to avoid transaction fail.
  tx = await cTT.borrow(ethers.utils.parseEther("0.05"), {gasLimit: 1000000});
  await tx.wait()

  console.log(`----------After Borrow----------`)
  cTTAccountSnapshot = await cTT.callStatic.getAccountSnapshot(admin.address)
  console.log(`cTT Balance: ${cTTAccountSnapshot[1]/(10**18)}`);      //0.2
  console.log(`Borrowed TT: ${cTTAccountSnapshot[2]/(10**18)}`);      //0.05
  console.log(`cTT ExchangeRate: ${cTTAccountSnapshot[3]/(10**18)}`); //1
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });