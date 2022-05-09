// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

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
  tx = await comptroller._become(unitroller.address)
  await tx.wait()
  comptroller = comptroller.attach(unitroller.address)
  console.log(`attach unitroller`)

  //////////////////////////
  // Setting up a CERC721 //
  //////////////////////////
 
  const testTokenId = 1;

  // Deploy ERC721
  const ERC721 = await hre.ethers.getContractFactory("ERC721");
  let erc721 = await ERC721.deploy();
  await erc721.deployed();

  console.log(`erc721 deployed: ${erc721.address}`)

  await erc721.mint(testTokenId);
  const mintAmount = await erc721.balanceOf(admin.address)
  console.log('mintAmount', mintAmount)
  
  // Deploy CERC721
  const CErc721 = await hre.ethers.getContractFactory("CErc721");
  let cErc721 = await CErc721.deploy(erc721.address, comptroller.address, "Compound Erc721", "CErc721");
  await cErc721.deployed();

  console.log(`cErc721 deployed: ${cErc721.address}`)

  // Mint test
  await erc721.approve(cErc721.address, testTokenId)
  await cErc721.mint(testTokenId)

  let balance = await erc721.balanceOf(admin.address)
  console.log('ERC721 balance', balance)

  let cbalance = await cErc721.balanceOf(admin.address)
  console.log('CERC721 balance', cbalance)

  //Redeem test
//   await cErc721.approve(cErc721.address, testTokenId)
//   await cErc721.redeem(testTokenId)

//   balance = await erc721.balanceOf(admin.address)
//   console.log('ERC721 balance', balance)

//   cbalance = await cErc721.balanceOf(admin.address)
//   console.log('CERC721 balance', cbalance)

  // Deploy & set price oracle
  const SimplePriceOracle = await hre.ethers.getContractFactory("SimplePriceOracle");
  const simplePriceOracle = await SimplePriceOracle.deploy();
  await simplePriceOracle.deployed();
  tx = await comptroller._setPriceOracle(simplePriceOracle.address)
  await tx.wait()
  console.log(`price oracle set`);

  tx = await simplePriceOracle.setUnderlyingPrice(cErc721.address, ethers.utils.parseEther("2800"))
  await tx.wait()

  let erc721Price = await simplePriceOracle.getUnderlyingPrice(cErc721.address);
  console.log(`NFT Price: ${erc721Price/(10**18)}`);

  //Add market
  tx = await comptroller._supportMarket(cErc721.address)
  await tx.wait()
  tx = await comptroller.enterMarkets([cErc721.address])
  await tx.wait()
  tx = await comptroller._setCollateralFactor(cErc721.address, ethers.utils.parseEther('0.8'));   
  await tx.wait();

  let liquidity = await comptroller.callStatic.getAccountLiquidity(admin.address);
  console.log(`liquidity: ${liquidity[1]/(10**18)}`);
  console.log(`shortfall: ${liquidity[2]/(10**18)}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
