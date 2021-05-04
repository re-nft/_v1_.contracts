import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("TD1", {
    from: deployer,
    log: true,
  });

  await deploy("TD18", {
    from: deployer,
    log: true,
  });

  await deploy("MyERC721", {
    from: deployer,
    log: true,
  });

  await deploy("E721B", {
    from: deployer,
    log: true,
  });

  await deploy("MyERC1155", {
    from: deployer,
    log: true,
  });

  await deploy("E1155B", {
    from: deployer,
    log: true,
  });

  await deploy("Utils", {
    from: deployer,
    log: true,
  });
};

export default func;

func.tags = ["Test"];
