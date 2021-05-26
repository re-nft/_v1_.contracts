import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // const resolver = await deploy("Resolver", {
  //   from: deployer,
  //   log: true,
  //   args: [deployer]
  // });

  // resolver address: 0x72F555A5C9c25e4aC31a6aE76E3a9f59A533B67F
  // renft address:    0x83962792bafb8bfc32bbb24afe57989a5154c21f

  await deploy("ReNFT", {
    from: deployer,
    log: true,
    args: ["0x72F555A5C9c25e4aC31a6aE76E3a9f59A533B67F", "0x28f11c3D76169361D22D8aE53551827Ac03360B0", deployer]
  });
};

export default func;

func.tags = ["ReNFT"];
