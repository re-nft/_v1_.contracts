import "dotenv/config";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import { HardhatUserConfig } from "hardhat/types";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";
import "@symfoni/hardhat-react";
import "hardhat-gas-reporter";

// * due to auto-generation the tests run much slower
// * unless this becomes opt-in, remove the comment out
// * to generate the new types
// * relating github issue: https://github.com/rhlsthrm/hardhat-typechain/issues/12
import "hardhat-typechain";
import "@typechain/ethers-v5";
import { node_url, accounts } from "./utils/network";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.0",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  namedAccounts: {
    deployer: 0,
    beneficiary: 1,
    lender: 2,
    renter: 3,
  },
  networks: {
    kovan: {
      url: node_url("kovan"),
      accounts: accounts(),
      gas: 6_000_000,
    },
    rinkeby: {
      url: node_url("rinkeby"),
      accounts: accounts(),
      gas: 6_000_000,
    },
    ropsten: {
      url: node_url("ropsten"),
      accounts: accounts(),
      gas: 6_000_000,
    },
    goerli: {
      url: node_url("goerli"),
      accounts: accounts(),
      gas: 6_000_000,
      gasPrice: 50000000000,
    },
    hardhat: {
      accounts: accounts(),
    },
    localhost: {
      url: "http://localhost:8545",
      accounts: accounts(),
    },
    mainnet: {
      url: node_url("mainnet"),
      accounts: accounts("mainnet"),
    },
  },
  paths: {
    sources: "src",
  },
  mocha: {
    timeout: 0,
  },
  gasReporter: {
    currency: "USD",
  },
};

export default config;
