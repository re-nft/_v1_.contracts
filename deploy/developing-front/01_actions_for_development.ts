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

  const resolver = ((await ethers.getContract(
    "Resolver",
    deployer
  )) as any) as Resolver;

  await deploy("ReNFT", {
    from: deployer,
    log: true,
    args: [resolver.address, beneficiary, deployer],
  });

  const e721 = ((await ethers.getContract(
    "E721",
    lender
  )) as any) as E721;
  const e721b = ((await ethers.getContract(
    "E721B",
    lender
  )) as any) as E721B;

  for (let i = 0; i < 10; i++) await e721.award();
  for (let i = 0; i < 10; i++) await e721b.award();

  // * also send through 100 erc20 tokens to everyone
  const dai = ((await ethers.getContract("DAI", deployer)) as any) as ERC20;
  const usdc = ((await ethers.getContract("USDC", deployer)) as any) as ERC20;
  const amtToSend = ethers.utils.parseEther("100000000");

  await usdc.transfer(lender, amtToSend);
  await usdc.transfer(beneficiary, amtToSend);
  await usdc.transfer(renter, amtToSend);

  await dai.transfer(lender, amtToSend);
  await dai.transfer(beneficiary, amtToSend);
  await dai.transfer(renter, amtToSend);

  // * set the resolver to resolve to the correct payment token
  await resolver.setPaymentToken(2, dai.address);
  await resolver.setPaymentToken(3, usdc.address);
};

export default func;

func.tags = ["Development"];
func.dependencies = ["Test"];
