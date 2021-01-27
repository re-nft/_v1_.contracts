/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  ethers,
  EventFilter,
  Signer,
  BigNumber,
  BigNumberish,
  PopulatedTransaction,
} from "ethers";
import {
  Contract,
  ContractTransaction,
  Overrides,
  CallOverrides,
} from "@ethersproject/contracts";
import { BytesLike } from "@ethersproject/bytes";
import { Listener, Provider } from "@ethersproject/providers";
import { FunctionFragment, EventFragment, Result } from "@ethersproject/abi";

interface IFreeFromUpToInterface extends ethers.utils.Interface {
  functions: {
    "c_0xb9603089(bytes32)": FunctionFragment;
    "freeFromUpTo(address,uint256)": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "c_0xb9603089",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "freeFromUpTo",
    values: [string, BigNumberish]
  ): string;

  decodeFunctionResult(
    functionFragment: "c_0xb9603089",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "freeFromUpTo",
    data: BytesLike
  ): Result;

  events: {};
}

export class IFreeFromUpTo extends Contract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  on(event: EventFilter | string, listener: Listener): this;
  once(event: EventFilter | string, listener: Listener): this;
  addListener(eventName: EventFilter | string, listener: Listener): this;
  removeAllListeners(eventName: EventFilter | string): this;
  removeListener(eventName: any, listener: Listener): this;

  interface: IFreeFromUpToInterface;

  functions: {
    c_0xb9603089(
      c__0xb9603089: BytesLike,
      overrides?: CallOverrides
    ): Promise<[void]>;

    "c_0xb9603089(bytes32)"(
      c__0xb9603089: BytesLike,
      overrides?: CallOverrides
    ): Promise<[void]>;

    freeFromUpTo(
      from: string,
      value: BigNumberish,
      overrides?: Overrides
    ): Promise<ContractTransaction>;

    "freeFromUpTo(address,uint256)"(
      from: string,
      value: BigNumberish,
      overrides?: Overrides
    ): Promise<ContractTransaction>;
  };

  c_0xb9603089(
    c__0xb9603089: BytesLike,
    overrides?: CallOverrides
  ): Promise<void>;

  "c_0xb9603089(bytes32)"(
    c__0xb9603089: BytesLike,
    overrides?: CallOverrides
  ): Promise<void>;

  freeFromUpTo(
    from: string,
    value: BigNumberish,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  "freeFromUpTo(address,uint256)"(
    from: string,
    value: BigNumberish,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  callStatic: {
    c_0xb9603089(
      c__0xb9603089: BytesLike,
      overrides?: CallOverrides
    ): Promise<void>;

    "c_0xb9603089(bytes32)"(
      c__0xb9603089: BytesLike,
      overrides?: CallOverrides
    ): Promise<void>;

    freeFromUpTo(
      from: string,
      value: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    "freeFromUpTo(address,uint256)"(
      from: string,
      value: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  filters: {};

  estimateGas: {
    c_0xb9603089(
      c__0xb9603089: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    "c_0xb9603089(bytes32)"(
      c__0xb9603089: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    freeFromUpTo(
      from: string,
      value: BigNumberish,
      overrides?: Overrides
    ): Promise<BigNumber>;

    "freeFromUpTo(address,uint256)"(
      from: string,
      value: BigNumberish,
      overrides?: Overrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    c_0xb9603089(
      c__0xb9603089: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    "c_0xb9603089(bytes32)"(
      c__0xb9603089: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    freeFromUpTo(
      from: string,
      value: BigNumberish,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;

    "freeFromUpTo(address,uint256)"(
      from: string,
      value: BigNumberish,
      overrides?: Overrides
    ): Promise<PopulatedTransaction>;
  };
}
