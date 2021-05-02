import 'dotenv/config';
import { HardhatUserConfig } from 'hardhat/types';
import 'solidity-coverage';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-etherscan';
import '@symfoni/hardhat-react';

// * due to auto-generation the tests run much slower
// * unless this becomes opt-in, remove the comment out
// * to generate the new types
// * relating github issue: https://github.com/rhlsthrm/hardhat-typechain/issues/12
import 'hardhat-typechain';
import '@typechain/ethers-v5';
import { node_url, accounts } from './utils/network';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.3',
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
    hardhat: {
      accounts: accounts(),
    },
    localhost: {
      url: 'http://localhost:8545',
      accounts: accounts(),
    },
    mainnet: {
      url: node_url('mainnet'),
      accounts: accounts('mainnet'),
    },
  },
  paths: {
    sources: 'src',
  },
  mocha: {
    timeout: 0,
  }
};

export default config;
