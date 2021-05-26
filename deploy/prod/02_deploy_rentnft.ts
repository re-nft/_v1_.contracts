import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer, beneficiary } = await getNamedAccounts();

  const signer = await ethers.getSigner(deployer);
  const gasPrice = await signer.getGasPrice();

  const resolver = await deploy("Resolver", {
    from: deployer,
    log: true,
    args: [deployer],
    gasPrice
  });

  await deploy("ReNFT", {
    from: deployer,
    log: true,
    args: [resolver.address, beneficiary, deployer],
    gasPrice
  });
};

export default func;

func.tags = ["ReNFT"];
