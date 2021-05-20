import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { lender, deployer, beneficiary } = await getNamedAccounts();

  await deploy("WETH", {
    from: deployer,
    log: true,
    args: [deployer],
  });

  await deploy("DAI", {
    from: deployer,
    log: true,
    args: [deployer],
  });

  await deploy("USDC", {
    from: deployer,
    log: true,
    args: [deployer],
  });

  await deploy("USDT", {
    from: deployer,
    log: true,
    args: [deployer],
  });

  await deploy("E721", {
    from: deployer,
    log: true,
  });

  await deploy("E721B", {
    from: deployer,
    log: true,
  });

  await deploy("E1155", {
    from: deployer,
    log: true,
    args: [deployer, beneficiary, lender],
  });

  await deploy("E1155B", {
    from: deployer,
    log: true,
    args: [deployer, beneficiary, lender],
  });

  await deploy("Utils", {
    from: deployer,
    log: true,
  });
};

export default func;

func.tags = ["Test"];
