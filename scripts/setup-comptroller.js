// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers } = require("hardhat");
const hre = require("hardhat");
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
  console.log(`admin: ${admin.address}`)

  //////////////////////////////
  // Setting up a Comptroller //
  //////////////////////////////

  
  // Setup Comptroller
  let comptroller = await ethers.getContractAt("Comptroller", process.env.RINKEBY_COMTROLLER_ADDR,);
  const unitroller = await ethers.getContractAt("Unitroller", process.env.RINKEBY_UNITROLLER_ADDR,);
  comptroller = comptroller.attach(unitroller.address)
  console.log(`Comptroller setup`)

  // Setup Test CErc20Token Delegator, the entry point for delegate
  const cttDelegator = await ethers.getContractAt("CErc20Delegator", process.env.RINKEBY_CTT_DELEGATOR_ADDR);
  console.log(`CTT Delegator: ${cttDelegator.address}`)

  // Setup Test2 CErc20Token Delegator, the entry point for delegate
  const ct2tDelegator = await ethers.getContractAt("CErc20Delegate", process.env.RINKEBY_CT2T_DELEGATOR_ADDR);
  console.log(`CT2T Delegator: ${ct2tDelegator.address}`)

  tx = await ct2tDelegator.mint(1)
  await tx.wait()
  console.log(`mint CT2T`)

  tx = await ct2tDelegator.redeem(1)
  await tx.wait()
  console.log(`redeem CT2T`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });