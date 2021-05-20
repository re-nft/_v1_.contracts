/* eslint-disable */
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
// ! ignores required because frontend is auto-generated
// ! and your typescript will not compile on the first run
//@ts-ignore
import { ERC20 } from "../../frontend/src/hardhat/typechain/ERC20";
//@ts-ignore
import { E721 } from "../../frontend/src/hardhat/typechain/E721";
//@ts-ignore
import { E721B } from "../../frontend/src/hardhat/typechain/E721B";
//@ts-ignore
import { Resolver } from "../../frontend/src/hardhat/typechain/Resolver";
import { Contract } from "typechain";

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

  await deploy("Resolver", {
    from: deployer,
    log: true,
    args: [deployer],
  });

  const resolver = <Resolver>await ethers.getContract("Resolver", deployer);

  await deploy("ReNFT", {
    from: deployer,
    log: true,
    args: [resolver.address, beneficiary, deployer],
  });

  const e721 = <E721>await ethers.getContract("E721", lender);
  const e721b = <E721B>await ethers.getContract("E721B", lender);

  Promise.all([Array(10).fill(e721.award()), Array(10).fill(e721b.award())]);

  // * also send through 100 erc20 tokens to everyone
  const weth = <ERC20>await ethers.getContract("WETH", deployer);
  const dai = <ERC20>await ethers.getContract("DAI", deployer);
  const usdc = <ERC20>await ethers.getContract("USDC", deployer);
  const usdt = <ERC20>await ethers.getContract("USDT", deployer);

  const amtToSend = ethers.utils.parseEther("10000");

  await weth.transfer(lender, amtToSend);
  await weth.transfer(beneficiary, amtToSend);
  await weth.transfer(renter, amtToSend);

  await usdt.transfer(lender, amtToSend);
  await usdt.transfer(beneficiary, amtToSend);
  await usdt.transfer(renter, amtToSend);

  await usdc.transfer(lender, amtToSend);
  await usdc.transfer(beneficiary, amtToSend);
  await usdc.transfer(renter, amtToSend);

  await dai.transfer(lender, amtToSend);
  await dai.transfer(beneficiary, amtToSend);
  await dai.transfer(renter, amtToSend);

  await resolver.setPaymentToken(1, weth.address);
  await resolver.setPaymentToken(2, dai.address);
  await resolver.setPaymentToken(3, usdc.address);
};

export default func;

func.tags = ["Development"];
func.dependencies = ["Test"];
