import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer, beneficiary } = await getNamedAccounts();

  const resolver = await deploy('Resolver', {
    from: deployer,
    log: true,
    args: [deployer],
    deterministicDeployment: true,
  });

  await deploy('ReNft', {
    from: deployer,
    log: true,
    args: [resolver.address, beneficiary, deployer],
    deterministicDeployment: true,
  });
};

export default func;

func.tags = ['ReNft'];
