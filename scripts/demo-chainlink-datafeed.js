// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { BigNumber } = ethers;
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
  admin = (await ethers.getSigners())[0];
  console.log(`admin: ${admin.address}`);

  ///////////////////////
  // Setup Comptroller //
  ///////////////////////

  // Deploy Comptroller
  const Comptroller = await hre.ethers.getContractFactory("contracts/Comptroller.sol:Comptroller");
  let comptroller = await Comptroller.deploy();
  await comptroller.deployed();
  console.log(`comptroller deployed: ${comptroller.address}`)
  
  // Deploy Unitroller
  const Unitroller = await hre.ethers.getContractFactory("Unitroller");
  const unitroller = await Unitroller.deploy();
  await unitroller.deployed();
  console.log(`unitroller deployed: ${unitroller.address}`)

  // Unitroller Proxy setting
  tx = await unitroller._setPendingImplementation(comptroller.address)
  await tx.wait()
  console.log(`set comptroller`)

  tx = await comptroller._become(unitroller.address)
  await tx.wait()
  console.log(`set unitroller`)

  comptroller = comptroller.attach(unitroller.address)
  console.log(`attach unitroller`)

  ///////////////////////
  // Setup cETH market //
  ///////////////////////

  // Deploy interest rate model
  const InterestModel = await hre.ethers.getContractFactory("JumpRateModelV2");
  const interestModel = await InterestModel.deploy(0, 2102400, ethers.utils.parseEther("0.2"), ethers.utils.parseEther("0.8"), admin.address);
  await interestModel.deployed();
  console.log(`interestModel address: ${comptroller.address}`);

  // Deploy CETH
  const CETH = await hre.ethers.getContractFactory("CEther");
  const cEth = await CETH.deploy(unitroller.address, interestModel.address, 1, "Compound ETH", "cETH", 8, admin.address);
  await cEth.deployed();
  console.log('cETH address', cEth.address);

  ////////////////////////////
  // Setup Chainlink Oracle //
  ////////////////////////////
  
  // Deploy Chainlink Oracle Datafeed Client
  const MyChainLinkPriceOracle = await hre.ethers.getContractFactory("MyChainLinkPriceOracle");
  const myChainLinkPriceOracle = await MyChainLinkPriceOracle.deploy();
  await myChainLinkPriceOracle.deployed();
  console.log(`price oracle deployed: ${myChainLinkPriceOracle.address}`);

  // Set Price Oracle
  tx = await comptroller._setPriceOracle(myChainLinkPriceOracle.address);
  await tx.wait();
  console.log(`set price oracle`);

  // Set chainlink aggregator address
  tx = await myChainLinkPriceOracle._setAggregators(
    ['0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'],
    ['0x8A753747A1Fa494EC906cE90E9f37563A8AF630e']
  );
  await tx.wait();
  console.log(`set aggregator`);

  /////////////////////////////////////
  // Get Price from Chainlink Oracle //
  /////////////////////////////////////

  let ethPrice = await myChainLinkPriceOracle.getUnderlyingPrice(cEth.address);
  console.log(`ETH/USD Price: ${ethPrice}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });