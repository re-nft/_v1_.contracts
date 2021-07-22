import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const TUSD = "0x0000000000085d4780B73119b644AE5ecd22b376";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;
  const { deployer, beneficiary } = await getNamedAccounts();
  const signer = await ethers.getSigner(deployer);

  const GAS_PRICE =
    (await signer.getGasPrice()).add(ethers.utils.parseUnits("10", "gwei")) ??
    ethers.utils.parseUnits("50", "gwei");

  const resolver = await deploy("Resolver", {
    from: deployer,
    log: true,
    args: [deployer],
    gasPrice: GAS_PRICE,
  });

  const _beneficiary =
    network.name == "localhost" || network.name == "hardhat"
      ? beneficiary
      : "0x28f11c3D76169361D22D8aE53551827Ac03360B0";
  await deploy("ReNFT", {
    from: deployer,
    log: true,
    args: [resolver.address, _beneficiary, deployer],
    gasPrice: GAS_PRICE,
  });

  if (network.name == "mainnet") {
    const r = await ethers.getContract("Resolver", signer);
    await (
      await r.setPaymentToken(1, WETH, {
        gasPrice: GAS_PRICE,
      })
    ).wait();
    await (
      await r.setPaymentToken(2, DAI, {
        gasPrice: GAS_PRICE,
      })
    ).wait();
    await (
      await r.setPaymentToken(3, USDC, {
        gasPrice: GAS_PRICE,
      })
    ).wait();
    await (
      await r.setPaymentToken(4, USDT, {
        gasPrice: GAS_PRICE,
      })
    ).wait();
    await (
      await r.setPaymentToken(5, TUSD, {
        gasPrice: GAS_PRICE,
      })
    ).wait();
  }
};

export default func;

func.tags = ["ReNFT"];
