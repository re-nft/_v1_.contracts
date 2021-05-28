/* eslint-disable */
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
// ! ignores required because frontend is auto-generated
// ! and your typescript will not compile on the first run

import { ERC20 } from "../../frontend/src/hardhat/typechain/ERC20";
import { E721 } from "../../frontend/src/hardhat/typechain/E721";
import { E721B } from "../../frontend/src/hardhat/typechain/E721B";
import { Resolver } from "../../frontend/src/hardhat/typechain/Resolver";


// TODO: this fails somewhere when deploying to testnets

/**
 * Gives everyone a bit of ERC20 test tokens & mints all erc721s
 * to lender named account, & erc1155s to lender and other top 2
 * accounts
 * @param hre
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, ethers, deployments } = hre;
  const { lender, deployer, beneficiary, renter } = await getNamedAccounts();
  const { deploy } = deployments;

  const signer = await ethers.getSigner(deployer);
  const gasPrice = await signer.getGasPrice() ?? ethers.utils.parseUnits("50", "gwei");
  const opts = { gasPrice }

  await deploy("Resolver", {
    from: deployer,
    log: true,
    args: [deployer],
    gasPrice
  });

  const resolver = <Resolver>await ethers.getContract("Resolver", deployer);

  await deploy("ReNFT", {
    from: deployer,
    log: true,
    args: [resolver.address, beneficiary, deployer],
    gasPrice
  });

  // !!!! If this isn't localhost chain, change "lender" to "deployer"
  const e721 = <E721>await ethers.getContract("E721", deployer);
  const e721b = <E721B>await ethers.getContract("E721B", deployer);

  await (await e721.award(opts)).wait();
  await (await e721.award(opts)).wait();
  await (await e721.award(opts)).wait();
  await (await e721.award(opts)).wait();
  await (await e721.award(opts)).wait();
  await (await e721.award(opts)).wait();
  await (await e721.award(opts)).wait();
  await (await e721.award(opts)).wait();
  await (await e721.award(opts)).wait();
  await (await e721.award(opts)).wait();

  await (await e721b.award(opts)).wait();
  await (await e721b.award(opts)).wait();
  await (await e721b.award(opts)).wait();
  await (await e721b.award(opts)).wait();
  await (await e721b.award(opts)).wait();
  await (await e721b.award(opts)).wait();
  await (await e721b.award(opts)).wait();
  await (await e721b.award(opts)).wait();
  await (await e721b.award(opts)).wait();
  await (await e721b.award(opts)).wait();

  console.log(" 🎨  nfts awarded 🎨 ")

  // * also send through 100 erc20 tokens to everyone
  const weth = <ERC20>await ethers.getContract("WETH", deployer);
  const dai = <ERC20>await ethers.getContract("DAI", deployer);
  const usdc = <ERC20>await ethers.getContract("USDC", deployer);
  const usdt = <ERC20>await ethers.getContract("USDT", deployer);
  const tusd = <ERC20>await ethers.getContract("TUSD", deployer);

  await (await resolver.setPaymentToken(1, weth.address)).wait();
  await (await resolver.setPaymentToken(2, dai.address)).wait();
  await (await resolver.setPaymentToken(3, usdc.address)).wait();
  await (await resolver.setPaymentToken(4, usdt.address)).wait();
  await (await resolver.setPaymentToken(5, tusd.address)).wait();

  console.log(" 💠  resolver set payment tokens 💠 ");

  const amtToSend = ethers.utils.parseEther("10000");

  await (await weth.transfer(lender, amtToSend, opts)).wait();
  await (await weth.transfer(beneficiary, amtToSend, opts)).wait();
  await (await weth.transfer(renter, amtToSend, opts)).wait();

  await (await usdt.transfer(lender, amtToSend, opts)).wait();
  await (await usdt.transfer(beneficiary, amtToSend, opts)).wait();
  await (await usdt.transfer(renter, amtToSend, opts)).wait();

  await (await usdc.transfer(lender, amtToSend, opts)).wait();
  await (await usdc.transfer(beneficiary, amtToSend, opts)).wait();
  await (await usdc.transfer(renter, amtToSend, opts)).wait();

  await (await dai.transfer(lender, amtToSend, opts)).wait();
  await (await dai.transfer(beneficiary, amtToSend, opts)).wait();
  await (await dai.transfer(renter, amtToSend, opts)).wait();

  await (await tusd.transfer(lender, amtToSend, opts)).wait();
  await (await tusd.transfer(beneficiary, amtToSend, opts)).wait();
  await (await tusd.transfer(renter, amtToSend, opts)).wait();

  console.log(" 💵  payment tokens distributed 💵 ")
};

export default func;

func.tags = ["Development"];
func.dependencies = ["Test"];
