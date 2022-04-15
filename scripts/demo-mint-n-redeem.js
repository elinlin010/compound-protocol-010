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
  //console.log(`admin: ${admin.address}`)

  let comptroller = await ethers.getContractAt("Comptroller", process.env.RINKEBY_COMPTROLLER_ADDR);
  const unitroller = await ethers.getContractAt("Unitroller", process.env.RINKEBY_UNITROLLER_ADDR);
  comptroller = comptroller.attach(unitroller.address)
  //console.log(`attach unitroller`)

  // Setup Test CErc20Token & Delegator, the entry point for delegate
  const testToken = await ethers.getContractAt("TestToken", process.env.RINKEBY_TT_ADDR);
  const cttDelegator = await ethers.getContractAt("CErc20Delegator", process.env.RINKEBY_CTT_DELEGATOR_ADDR);
  //console.log(`CTT Delegator: ${cttDelegator.address}`)

  tx = await comptroller._setCollateralFactor(cttDelegator.address, ethers.utils.parseEther('0.7'));   
  await tx.wait();

  // Setup Test2 CErc20Token & Delegator, the entry point for delegate
  const test2Token = await ethers.getContractAt("Test2Token", process.env.RINKEBY_T2T_ADDR);
  const ct2tDelegator = await ethers.getContractAt("CErc20Delegator", process.env.RINKEBY_CT2T_DELEGATOR_ADDR);
  tx = await comptroller._setCollateralFactor(ct2tDelegator.address, ethers.utils.parseEther('0.7'));   
  await tx.wait();

  // Enter CTT & CT2T
  tx = await comptroller.enterMarkets([cttDelegator.address, cttDelegator.address])
  await tx.wait()

  // Mint CTT
  let admin_balance = await cttDelegator.balanceOf(admin.address)
  console.log(`CTT balance before mint: ${admin_balance}`);

  tx = await testToken.approve(cttDelegator.address, ethers.utils.parseEther('1000'))
  await tx.wait()
  console.log(`Approve CTT delegator to transfer from account`)

  tx = await cttDelegator.mint(ethers.utils.parseEther('1'))
  await tx.wait()
  console.log(`mint 1e8 CTT`)

  admin_balance = await cttDelegator.balanceOf(admin.address)
  console.log(`CTT balance after mint: ${admin_balance}`);

  // Redeem TT
  // tx = await cttDelegator.redeemUnderlying(ethers.utils.parseEther('10'))
  // await tx.wait()
  // console.log(`redeem 10 TT`)

  // admin_balance = await testToken.balanceOf(admin.address)
  // console.log(`TT balance after redeem: ${admin_balance}`);

  // Borrow TT
  // let admin_balance_2 = await testToken.balanceOf(admin.address)
  // console.log(`TT balance before borrow: ${admin_balance_2}`)

  // tx = await cttDelegator.borrow(2)
  // await tx.wait()
  // console.log(`borrow 2 TT`)

  // admin_balance_2 = await testToken.balanceOf(admin.address)
  // console.log(`TT balance after borrow: ${admin_balance_2}`)

  // Borrow T2T
  // let admin_balance_3 = await test2Token.balanceOf(admin.address)
  // console.log(`T2T balance before borrow: ${admin_balance_3}`)

  // tx = await ct2tDelegator.borrow(ethers.utils.parseEther('2'))
  // await tx.wait()
  // console.log(`borrow 2 T2T`)

  // admin_balance_3 = await test2Token.balanceOf(admin.address)
  // console.log(`T2T balance after borrow: ${admin_balance_3}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });