/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import { Contract, ContractFactory, Overrides } from "@ethersproject/contracts";

import type { MyERC1155 } from "../MyERC1155";

export class MyERC1155__factory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(overrides?: Overrides): Promise<MyERC1155> {
    return super.deploy(overrides || {}) as Promise<MyERC1155>;
  }
  getDeployTransaction(overrides?: Overrides): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): MyERC1155 {
    return super.attach(address) as MyERC1155;
  }
  connect(signer: Signer): MyERC1155__factory {
    return super.connect(signer) as MyERC1155__factory;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): MyERC1155 {
    return new Contract(address, _abi, signerOrProvider) as MyERC1155;
  }
}

const _abi = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "approved",
        type: "bool",
      },
    ],
    name: "ApprovalForAll",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "ids",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "values",
        type: "uint256[]",
      },
    ],
    name: "TransferBatch",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "TransferSingle",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "string",
        name: "value",
        type: "string",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "URI",
    type: "event",
  },
  {
    inputs: [],
    name: "award",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address[]",
        name: "accounts",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "ids",
        type: "uint256[]",
      },
    ],
    name: "balanceOfBatch",
    outputs: [
      {
        internalType: "uint256[]",
        name: "",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "c__0x98ef75e9",
        type: "bytes32",
      },
    ],
    name: "c_0x98ef75e9",
    outputs: [],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
    ],
    name: "isApprovedForAll",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256[]",
        name: "ids",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "safeBatchTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "safeTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
      {
        internalType: "bool",
        name: "approved",
        type: "bool",
      },
    ],
    name: "setApprovalForAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes4",
        name: "interfaceId",
        type: "bytes4",
      },
    ],
    name: "supportsInterface",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "uri",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const _bytecode =
  "0x60806040523480156200001157600080fd5b506040518060400160405280601e81526020017f68747470733a2f2f67616d652e6578616d706c652f6170692f6974656d2f0000815250620000606301ffc9a760e01b620000dc60201b60201c565b6200007181620001e560201b60201c565b6200008963d9b67a2660e01b620000dc60201b60201c565b620000a1630e89341c60e01b620000dc60201b60201c565b50620000d67f3850a31d82d47941f96e8e180b53229109bca689b89707e593cc6946145bd4e260001b6200020160201b60201c565b620002ba565b63ffffffff60e01b817bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916141562000179576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601c8152602001807f4552433136353a20696e76616c696420696e746572666163652069640000000081525060200191505060405180910390fd5b6001600080837bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19167bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916815260200190815260200160002060006101000a81548160ff02191690831515021790555050565b8060039080519060200190620001fd92919062000204565b5050565b50565b828054600181600116156101000203166002900490600052602060002090601f0160209004810192826200023c576000855562000288565b82601f106200025757805160ff191683800117855562000288565b8280016001018555821562000288579182015b82811115620002875782518255916020019190600101906200026a565b5b5090506200029791906200029b565b5090565b5b80821115620002b65760008160009055506001016200029c565b5090565b6124c880620002ca6000396000f3fe608060405234801561001057600080fd5b506004361061009d5760003560e01c80634e1273f4116100665780634e1273f41461044f57806382d3b937146105f0578063a22cb4651461061e578063e985e9c51461066e578063f242432a146106e85761009d565b8062fdd58e146100a257806301ffc9a7146101045780630e89341c146101675780632eb2c2d61461020e57806341a494c514610431575b600080fd5b6100ee600480360360408110156100b857600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506107f7565b6040518082815260200191505060405180910390f35b61014f6004803603602081101561011a57600080fd5b8101908080357bffffffffffffffffffffffffffffffffffffffffffffffffffffffff191690602001909291905050506108d7565b60405180821515815260200191505060405180910390f35b6101936004803603602081101561017d57600080fd5b810190808035906020019092919050505061093e565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156101d35780820151818401526020810190506101b8565b50505050905090810190601f1680156102005780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b61042f600480360360a081101561022457600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035906020019064010000000081111561028157600080fd5b82018360208201111561029357600080fd5b803590602001918460208302840111640100000000831117156102b557600080fd5b919080806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f8201169050808301925050505050505091929192908035906020019064010000000081111561031557600080fd5b82018360208201111561032757600080fd5b8035906020019184602083028401116401000000008311171561034957600080fd5b919080806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f820116905080830192505050505050509192919290803590602001906401000000008111156103a957600080fd5b8201836020820111156103bb57600080fd5b803590602001918460018302840111640100000000831117156103dd57600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f8201169050808301925050505050505091929192905050506109e2565b005b610439610e6d565b6040518082815260200191505060405180910390f35b6105996004803603604081101561046557600080fd5b810190808035906020019064010000000081111561048257600080fd5b82018360208201111561049457600080fd5b803590602001918460208302840111640100000000831117156104b657600080fd5b919080806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f8201169050808301925050505050505091929192908035906020019064010000000081111561051657600080fd5b82018360208201111561052857600080fd5b8035906020019184602083028401116401000000008311171561054a57600080fd5b919080806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f820116905080830192505050505050509192919290505050610faf565b6040518080602001828103825283818151815260200191508051906020019060200280838360005b838110156105dc5780820151818401526020810190506105c1565b505050509050019250505060405180910390f35b61061c6004803603602081101561060657600080fd5b81019080803590602001909291905050506111a1565b005b61066c6004803603604081101561063457600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035151590602001909291905050506111a4565b005b6106d06004803603604081101561068457600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff16906020019092919050505061133d565b60405180821515815260200191505060405180910390f35b6107f5600480360360a08110156106fe57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190803590602001909291908035906020019064010000000081111561076f57600080fd5b82018360208201111561078157600080fd5b803590602001918460018302840111640100000000831117156107a357600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f8201169050808301925050505050505091929192905050506113d1565b005b60008073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16141561087e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252602b8152602001806122f2602b913960400191505060405180910390fd5b6001600083815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b6000806000837bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19167bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916815260200190815260200160002060009054906101000a900460ff169050919050565b606060038054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156109d65780601f106109ab576101008083540402835291602001916109d6565b820191906000526020600020905b8154815290600101906020018083116109b957829003601f168201915b50505050509050919050565b8151835114610a3c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252602881526020018061244a6028913960400191505060405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff161415610ac2576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260258152602001806123776025913960400191505060405180910390fd5b610aca611746565b73ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff161480610b105750610b0f85610b0a611746565b61133d565b5b610b65576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252603281526020018061239c6032913960400191505060405180910390fd5b6000610b6f611746565b9050610b7f81878787878761174e565b60005b8451811015610d50576000858281518110610b9957fe5b602002602001015190506000858381518110610bb157fe5b60200260200101519050610c38816040518060600160405280602a81526020016123ce602a91396001600086815260200190815260200160002060008d73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546117569092919063ffffffff16565b6001600084815260200190815260200160002060008b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550610cef816001600085815260200190815260200160002060008b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461181690919063ffffffff16565b6001600084815260200190815260200160002060008a73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055505050806001019050610b82565b508473ffffffffffffffffffffffffffffffffffffffff168673ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff167f4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb8787604051808060200180602001838103835285818151815260200191508051906020019060200280838360005b83811015610e00578082015181840152602081019050610de5565b50505050905001838103825284818151815260200191508051906020019060200280838360005b83811015610e42578082015181840152602081019050610e27565b5050505090500194505050505060405180910390a4610e6581878787878761189e565b505050505050565b6000610e9b7feddb5f9a90c07015b0d5591fa01ef16a2b95f52cfa7427eedc5058b63cf9926960001b6111a1565b610ec77fea810122557685ca22772c39b1cc7b7d13f8233880c8b4f7b702ac22e06e245660001b6111a1565b600460008154809291906001019190505550610f057f8d80ec53cf85db01553c8daf0bbdbab49f5e4bf7114e41ca660e410536a5941c60001b6111a1565b610f317ff8a0acb6e25f4308d321a3bacf932f258c27beb9fdfbdc8c3acd3329239fbf1260001b6111a1565b610f4f33600454600160405180602001604052806000815250611c2d565b610f7b7fed8ed61d2be8b427ac34677a14e687fca0b92fae233122a459458782e2460a3760001b6111a1565b610fa77face81c7ada834eb6a35baf96738b6d9f3598dda69c63b3895d4b4440fc355c9760001b6111a1565b600454905090565b6060815183511461100b576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260298152602001806124216029913960400191505060405180910390fd5b6000835167ffffffffffffffff8111801561102557600080fd5b506040519080825280602002602001820160405280156110545781602001602082028036833780820191505090505b50905060005b845181101561119657600073ffffffffffffffffffffffffffffffffffffffff1685828151811061108757fe5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1614156110fc576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252603181526020018061231d6031913960400191505060405180910390fd5b6001600085838151811061110c57fe5b60200260200101518152602001908152602001600020600086838151811061113057fe5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205482828151811061117f57fe5b60200260200101818152505080600101905061105a565b508091505092915050565b50565b8173ffffffffffffffffffffffffffffffffffffffff166111c3611746565b73ffffffffffffffffffffffffffffffffffffffff161415611230576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260298152602001806123f86029913960400191505060405180910390fd5b806002600061123d611746565b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548160ff0219169083151502179055508173ffffffffffffffffffffffffffffffffffffffff166112ea611746565b73ffffffffffffffffffffffffffffffffffffffff167f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c318360405180821515815260200191505060405180910390a35050565b6000600260008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16905092915050565b600073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff161415611457576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260258152602001806123776025913960400191505060405180910390fd5b61145f611746565b73ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff1614806114a557506114a48561149f611746565b61133d565b5b6114fa576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252602981526020018061234e6029913960400191505060405180910390fd5b6000611504611746565b905061152481878761151588611e30565b61151e88611e30565b8761174e565b6115a1836040518060600160405280602a81526020016123ce602a91396001600088815260200190815260200160002060008a73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546117569092919063ffffffff16565b6001600086815260200190815260200160002060008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550611658836001600087815260200190815260200160002060008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461181690919063ffffffff16565b6001600086815260200190815260200160002060008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508473ffffffffffffffffffffffffffffffffffffffff168673ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff167fc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f628787604051808381526020018281526020019250505060405180910390a461173e818787878787611ea1565b505050505050565b600033905090565b505050505050565b6000838311158290611803576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b838110156117c85780820151818401526020810190506117ad565b50505050905090810190601f1680156117f55780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b5060008385039050809150509392505050565b600080828401905083811015611894576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f536166654d6174683a206164646974696f6e206f766572666c6f77000000000081525060200191505060405180910390fd5b8091505092915050565b6118bd8473ffffffffffffffffffffffffffffffffffffffff166121ae565b15611c25578373ffffffffffffffffffffffffffffffffffffffff1663bc197c8187878686866040518663ffffffff1660e01b8152600401808673ffffffffffffffffffffffffffffffffffffffff1681526020018573ffffffffffffffffffffffffffffffffffffffff168152602001806020018060200180602001848103845287818151815260200191508051906020019060200280838360005b8381101561197557808201518184015260208101905061195a565b50505050905001848103835286818151815260200191508051906020019060200280838360005b838110156119b757808201518184015260208101905061199c565b50505050905001848103825285818151815260200191508051906020019080838360005b838110156119f65780820151818401526020810190506119db565b50505050905090810190601f168015611a235780820380516001836020036101000a031916815260200191505b5098505050505050505050602060405180830381600087803b158015611a4857600080fd5b505af1925050508015611a7c57506040513d6020811015611a6857600080fd5b810190808051906020019092919050505060015b611b8657611a886121df565b80611a935750611b35565b806040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b83811015611afa578082015181840152602081019050611adf565b50505050905090810190601f168015611b275780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b6040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260348152602001806122966034913960400191505060405180910390fd5b63bc197c8160e01b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916817bffffffffffffffffffffffffffffffffffffffffffffffffffffffff191614611c23576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260288152602001806122ca6028913960400191505060405180910390fd5b505b505050505050565b600073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff161415611cb3576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260218152602001806124726021913960400191505060405180910390fd5b6000611cbd611746565b9050611cde81600087611ccf88611e30565b611cd888611e30565b8761174e565b611d41836001600087815260200190815260200160002060008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461181690919063ffffffff16565b6001600086815260200190815260200160002060008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508473ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff167fc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f628787604051808381526020018281526020019250505060405180910390a4611e2981600087878787611ea1565b5050505050565b60606000600167ffffffffffffffff81118015611e4c57600080fd5b50604051908082528060200260200182016040528015611e7b5781602001602082028036833780820191505090505b5090508281600081518110611e8c57fe5b60200260200101818152505080915050919050565b611ec08473ffffffffffffffffffffffffffffffffffffffff166121ae565b156121a6578373ffffffffffffffffffffffffffffffffffffffff1663f23a6e6187878686866040518663ffffffff1660e01b8152600401808673ffffffffffffffffffffffffffffffffffffffff1681526020018573ffffffffffffffffffffffffffffffffffffffff16815260200184815260200183815260200180602001828103825283818151815260200191508051906020019080838360005b83811015611f79578082015181840152602081019050611f5e565b50505050905090810190601f168015611fa65780820380516001836020036101000a031916815260200191505b509650505050505050602060405180830381600087803b158015611fc957600080fd5b505af1925050508015611ffd57506040513d6020811015611fe957600080fd5b810190808051906020019092919050505060015b612107576120096121df565b8061201457506120b6565b806040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b8381101561207b578082015181840152602081019050612060565b50505050905090810190601f1680156120a85780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b6040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260348152602001806122966034913960400191505060405180910390fd5b63f23a6e6160e01b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916817bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916146121a4576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260288152602001806122ca6028913960400191505060405180910390fd5b505b505050505050565b600080823b905060008111915050919050565b6000601f19601f8301169050919050565b60008160e01c9050919050565b600060443d10156121ef57612292565b60046000803e6122006000516121d2565b6308c379a081146122115750612292565b60405160043d036004823e80513d602482011167ffffffffffffffff8211171561223d57505050612292565b808201805167ffffffffffffffff81111561225c575050505050612292565b8060208301013d850181111561227757505050505050612292565b612280826121c1565b60208401016040528296505050505050505b9056fe455243313135353a207472616e7366657220746f206e6f6e2045524331313535526563656976657220696d706c656d656e746572455243313135353a204552433131353552656365697665722072656a656374656420746f6b656e73455243313135353a2062616c616e636520717565727920666f7220746865207a65726f2061646472657373455243313135353a2062617463682062616c616e636520717565727920666f7220746865207a65726f2061646472657373455243313135353a2063616c6c6572206973206e6f74206f776e6572206e6f7220617070726f766564455243313135353a207472616e7366657220746f20746865207a65726f2061646472657373455243313135353a207472616e736665722063616c6c6572206973206e6f74206f776e6572206e6f7220617070726f766564455243313135353a20696e73756666696369656e742062616c616e636520666f72207472616e73666572455243313135353a2073657474696e6720617070726f76616c2073746174757320666f722073656c66455243313135353a206163636f756e747320616e6420696473206c656e677468206d69736d61746368455243313135353a2069647320616e6420616d6f756e7473206c656e677468206d69736d61746368455243313135353a206d696e7420746f20746865207a65726f2061646472657373a2646970667358221220a1127029d4bcd5c4aa6ef8b039de7bb9732418b19f83296c1f8f96f8f4b37a7064736f6c63430007060033";
