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

  // Deploy price oracle
  const SimplePriceOracle = await hre.ethers.getContractFactory("SimplePriceOracle");
  const simplePriceOracle = await SimplePriceOracle.deploy();
  await simplePriceOracle.deployed();

  console.log(`price oracle deployed: ${simplePriceOracle.address}`)

  // Set price oracle in comptroller
  tx = await comptroller._setPriceOracle(simplePriceOracle.address)
  await tx.wait()

  console.log(`set price oracle`)

  /////////////////////////
  // Setting up 1st CToken //
  /////////////////////////

  // Deploy a Test Erc20Token
  const TestToken = await hre.ethers.getContractFactory("TestToken");
  const testToken = await TestToken.deploy(ethers.utils.parseEther("1000"));
  await testToken.deployed();

  console.log(`Test token deployed: ${testToken.address}`)

  // Deploy Test Token Interest Model
  const TTInterestRateModel = await hre.ethers.getContractFactory("JumpRateModelV2");
  const ttInterestRateModel = await TTInterestRateModel.deploy(0, 23782343987, 518455098934, 8000000000000000, admin.address);
  await ttInterestRateModel.deployed();

  console.log(`Test Token interest model deployed: ${ttInterestRateModel.address}`)

  // Deploy Test CErc20Token Delegate
  const CTTDelegate = await hre.ethers.getContractFactory("CErc20Delegate");
  const cttDelegate = await CTTDelegate.deploy();

  await cttDelegate.deployed();

  console.log(`CTT Delegate deployed: ${cttDelegate.address}`)

  // Deploy Test CErc20Token Delegator, the entry point for delegate
  const CTTDelegator = await hre.ethers.getContractFactory("CErc20Delegator");
  const cttDelegator = await CTTDelegator.deploy(testToken.address, unitroller.address, ttInterestRateModel.address,
    ethers.utils.parseEther("50"), "CTestToken", "CTT", 8, admin.address, cttDelegate.address, 0x0);
  await cttDelegator.deployed();

  console.log(`CTT Delegator deployed: ${cttDelegator.address}`)

  // Set CTT Price in Oracle for test
  tx = await simplePriceOracle.setUnderlyingPrice(cttDelegator.address, 1)
  await tx.wait()

  console.log(`CTT price set`)

  // Add CTT into Comptroller markets
  tx = await comptroller._supportMarket(cttDelegator.address)
  await tx.wait()

  console.log(`Add CTT into markets`)


  //////////////////////
  // Enter CTT Market //
  //////////////////////

  tx = await testToken.approve(cttDelegator.address, 1000)
  await tx.wait()
  console.log(`Approve CTT delegator to transfer from account`)

  tx = await cttDelegator.mint(100)
  await tx.wait()
  console.log(`mint CTT`)

  ///////////////////////////
  // Setting up 2nd CToken //
  ///////////////////////////

  // Deploy a Test Erc20Token
  const Test2Token = await hre.ethers.getContractFactory("Test2Token");
  const test2Token = await Test2Token.deploy(ethers.utils.parseEther("1000"));
  await test2Token.deployed();

  console.log(`Test token deployed: ${test2Token.address}`)

  // Deploy Test2 Token Interest Model
  const T2TInterestRateModel = await hre.ethers.getContractFactory("JumpRateModelV2");
  const t2tInterestRateModel = await T2TInterestRateModel.deploy(0, 23782343987, 518455098934, 8000000000000000, admin.address);
  await t2tInterestRateModel.deployed();

  console.log(`Test2 Token interest model deployed: ${t2tInterestRateModel.address}`)

  // Deploy Test2 CErc20Token Delegate
  const CT2TDelegate = await hre.ethers.getContractFactory("CErc20Delegate");
  const ct2tDelegate = await CT2TDelegate.deploy();

  await ct2tDelegate.deployed();

  console.log(`CT2T Delegate deployed: ${ct2tDelegate.address}`)

  // Deploy Test2 CErc20Token Delegator, the entry point for delegate
  const CT2TDelegator = await hre.ethers.getContractFactory("CErc20Delegator");
  const ct2tDelegator = await CT2TDelegator.deploy(test2Token.address, unitroller.address, t2tInterestRateModel.address,
    ethers.utils.parseEther("50"), "CTest2Token", "CT2T", 8, admin.address, ct2tDelegate.address, 0x0);
  await ct2tDelegator.deployed();

  console.log(`CT2T Delegator deployed: ${ct2tDelegator.address}`)

  // Set CT2T Price in Oracle for test
  tx = await simplePriceOracle.setUnderlyingPrice(ct2tDelegator.address, 2)
  await tx.wait()

  console.log(`CT2T price set`)

  // Add CT2T into Comptroller markets
  tx = await comptroller._supportMarket(ct2tDelegator.address)
  await tx.wait()

  console.log(`Add CT2T into markets`)

  ///////////////////////
  // Enter CT2T Market //
  ///////////////////////

  tx = await test2Token.approve(ct2tDelegator.address, 2000)
  await tx.wait()
  console.log(`Approve CT2T delegator to transfer from account`)

  tx = await ct2tDelegator.mint(200)
  await tx.wait()
  console.log(`mint CT2T`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

/* Rinkeby
comptroller: 0xCd307FFd9d7a99AE71655F5CAd4065FE02c20552
unitroller: 0x66967F9EC2f58D11FeaAA2f9EB2C81beCd6A7371
price oracle: 0x5f2dB370D1aDd32E9793B1429c1695590B0735a7
Test token deployed: 0xDf8Bf5782aB14846807feE47d986ACe4F525fD3C
Test Token interest model: 0xA3212F5E289021a0c1de9AC53611b170d7862c0f
CTT Delegate deployed: 0xa712382825cAc6fAbD4e9BAF4533DD29FE0DF602
CTT Delegator deployed: 0xE373189a7BA9FB836b2dd751C897022Cd7C545e0
Test token deployed: 0x66CbE301B5d3b8B5a065156CC12B653c3455996E
Test2 Token interest model: 0x559d94bDC7165E44D585D85682dd48DEf90fEc82
CT2T Delegate deployed: 0xc5F976Cb46ac6bcFf223649426C88Fec48e5cE94
*/

/*Goerli
comptroller: 0xC26a2243C1f61e32834cd8224323A78422079332
unitroller: 0x45998011708B244072cfdd5586587Dd7AA440016
set comptroller
*/