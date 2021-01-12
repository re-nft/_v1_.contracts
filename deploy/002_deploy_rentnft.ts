import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer, beneficiary} = await getNamedAccounts();
  const resolver = await deployments.get('Resolver');
  await deploy('RentNft', {
    from: deployer,
    log: true,
    args: [resolver.address, beneficiary],
  });
};
export default func;
func.tags = ['RentNft'];
func.dependencies = ['Resolver'];