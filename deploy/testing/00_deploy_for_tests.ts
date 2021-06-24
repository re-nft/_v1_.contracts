import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;
  const { lender, deployer, beneficiary } = await getNamedAccounts();

  const signer = await ethers.getSigner(deployer);
  const gasPrice =
    (await signer.getGasPrice()).add(ethers.utils.parseUnits("10", "gwei")) ??
    ethers.utils.parseUnits("50", "gwei");

  await deploy("WETH", {
    from: deployer,
    log: true,
    args: [deployer],
    gasPrice,
  });

  await deploy("DAI", {
    from: deployer,
    log: true,
    args: [deployer],
    gasPrice,
  });

  await deploy("USDC", {
    from: deployer,
    log: true,
    args: [deployer],
    gasPrice,
  });

  await deploy("USDT", {
    from: deployer,
    log: true,
    args: [deployer],
    gasPrice,
  });

  await deploy("TUSD", {
    from: deployer,
    log: true,
    args: [deployer],
    gasPrice,
  });

  await deploy("E721", {
    from: deployer,
    log: true,
    gasPrice,
  });

  await deploy("E721B", {
    from: deployer,
    log: true,
    gasPrice,
  });

  const nftArgs =
    network.name == "localhost" || network.name == "hardhat"
      ? [deployer, beneficiary, lender]
      : [deployer, deployer, deployer];

  await deploy("E1155", {
    from: deployer,
    log: true,
    args: nftArgs,
    gasPrice,
  });

  await deploy("E1155B", {
    from: deployer,
    log: true,
    args: nftArgs,
    gasPrice,
  });

  await deploy("Utils", {
    from: deployer,
    log: true,
    gasPrice,
  });
};

export default func;

func.tags = ["Test"];
