// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

import "./interfaces/IResolver.sol";
import "./interfaces/IReNFT.sol";

//              @@@@@@@@@@@@@@@@        ,@@@@@@@@@@@@@@@@
//              @@@,,,,,,,,,,@@@        ,@@&,,,,,,,,,,@@@
//         @@@@@@@@,,,,,,,,,,@@@@@@@@&  ,@@&,,,,,,,,,,@@@@@@@@
//         @@@**********@@@@@@@@@@@@@&  ,@@@@@@@@**********@@@
//         @@@**********@@@@@@@@@@@@@&  ,@@@@@@@@**********@@@@@@@@
//         @@@**********@@@@@@@@@@@@@&       .@@@**********@@@@@@@@
//    @@@@@@@@**********@@@@@@@@@@@@@&       .@@@**********@@@@@@@@
//    @@@**********@@@@@@@@@@@@@&            .@@@@@@@@**********@@@
//    @@@**********@@@@@@@@@@@@@&            .@@@@@@@@**********@@@@@@@@
//    @@@@@@@@**********@@@@@@@@&            .@@@**********@@@@@@@@@@@@@
//    @@@@@@@@//////////@@@@@@@@&            .@@@//////////@@@@@@@@@@@@@
//         @@@//////////@@@@@@@@&            .@@@//////////@@@@@@@@@@@@@
//         @@@//////////@@@@@@@@&       ,@@@@@@@@//////////@@@@@@@@@@@@@
//         @@@%%%%%/////(((((@@@&       ,@@@(((((/////%%%%%@@@@@@@@
//         @@@@@@@@//////////@@@@@@@@&  ,@@@//////////@@@@@@@@@@@@@
//              @@@%%%%%%%%%%@@@@@@@@&  ,@@@%%%%%%%%%%@@@@@@@@@@@@@
//              @@@@@@@@@@@@@@@@@@@@@&  ,@@@@@@@@@@@@@@@@@@@@@@@@@@
//                   @@@@@@@@@@@@@@@@&        @@@@@@@@@@@@@@@@
//                   @@@@@@@@@@@@@@@@&        @@@@@@@@@@@@@@@@

contract ReNFT is IReNft, ERC721Holder, ERC1155Receiver, ERC1155Holder {
    using SafeERC20 for ERC20;

    IResolver private resolver;
    address private admin;
    address payable private beneficiary;
    uint256 private lendingId = 1;

    // in bps. so 1000 => 1%
    uint256 public rentFee = 1000;

    // single storage slot: address - 160 bits, 168, 200, 232, 240, 248
    struct Lending {
        address payable lenderAddress;
        uint8 maxRentDuration;
        bytes4 dailyRentPrice;
        bytes4 nftPrice;
        uint8 lentAmount;
        IResolver.PaymentToken paymentToken;
    }

    // single storage slot: 160 bits, 168, 200
    struct Renting {
        address payable renterAddress;
        uint8 rentDuration;
        uint32 rentedAt;
    }

    struct LendingRenting {
        Lending lending;
        Renting renting;
    }

    // 32 bytes key to 64 bytes struct
    mapping(bytes32 => LendingRenting) private lendingRenting;

    struct TwoPointer {
        uint256 lastIx;
        uint256 currIx;
        address[] nfts;
        uint256[] tokenIds;
        uint256[] lentAmounts;
        uint8[] maxRentDurations;
        bytes4[] dailyRentPrices;
        bytes4[] nftPrices;
        uint256[] lendingIds;
        uint8[] rentDurations;
        IResolver.PaymentToken[] paymentTokens;
    }

    constructor(
        address _resolver,
        address payable _beneficiary,
        address _admin
    ) {
        ensureIsNotZeroAddr(_resolver);
        ensureIsNotZeroAddr(_beneficiary);
        ensureIsNotZeroAddr(_admin);

        resolver = IResolver(_resolver);
        beneficiary = _beneficiary;
        admin = _admin;
    }

    function twoPointerLoop(
        function(TwoPointer memory) f,
        TwoPointer memory _tp
    ) private {
        require(_tp.nfts.length > 0, "invalid nfts len");
        if (_tp.nfts.length < 2) {
            f(_tp);
            return;
        }
        while (_tp.currIx < _tp.nfts.length) {
            if (
                (_tp.nfts[_tp.lastIx] == _tp.nfts[_tp.currIx]) &&
                (is1155(_tp.nfts[_tp.currIx]))
            ) {
                _tp.currIx++;
                continue;
            }
            f(_tp);
            _tp.lastIx = _tp.currIx;
            _tp.currIx++;
        }
        f(_tp);
    }

    // lend, rent, return, stop, claim

    function lend(
        address[] memory _nfts,
        uint256[] memory _tokenIds,
        uint256[] memory _lendAmounts,
        uint8[] memory _maxRentDurations,
        bytes4[] memory _dailyRentPrices,
        bytes4[] memory _nftPrices,
        IResolver.PaymentToken[] memory _paymentTokens
    ) external override {
        twoPointerLoop(
            handleLend,
            createLendTP(
                _nfts,
                _tokenIds,
                _lendAmounts,
                _maxRentDurations,
                _dailyRentPrices,
                _nftPrices,
                _paymentTokens
            )
        );
    }

    function rent(
        address[] memory _nfts,
        uint256[] memory _tokenIds,
        uint256[] memory _lendAmounts,
        uint256[] memory _lendingIds,
        uint8[] memory _rentDurations
    ) external override {
        twoPointerLoop(
            handleRent,
            createRentTP(
                _nfts,
                _tokenIds,
                _lendAmounts,
                _lendingIds,
                _rentDurations
            )
        );
    }

    function returnIt(
        address[] memory _nfts,
        uint256[] memory _tokenIds,
        uint256[] memory _lendAmounts,
        uint256[] memory _lendingIds
    ) external override {
        twoPointerLoop(
            handleReturn,
            createActionTP(_nfts, _tokenIds, _lendAmounts, _lendingIds)
        );
    }

    function stopLending(
        address[] memory _nfts,
        uint256[] memory _tokenIds,
        uint256[] memory _lendAmounts,
        uint256[] memory _lendingIds
    ) external override {
        twoPointerLoop(
            handleStopLending,
            createActionTP(_nfts, _tokenIds, _lendAmounts, _lendingIds)
        );
    }

    function claimCollateral(
        address[] memory _nfts,
        uint256[] memory _tokenIds,
        uint256[] memory _lendAmounts,
        uint256[] memory _lendingIds
    ) external override {
        twoPointerLoop(
            handleClaimCollateral,
            createActionTP(_nfts, _tokenIds, _lendAmounts, _lendingIds)
        );
    }

    //      .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.
    // `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'

    function takeFee(uint256 _rent, IResolver.PaymentToken _paymentToken)
        private
        returns (uint256 fee)
    {
        fee = _rent * rentFee;
        fee /= 10000;
        uint8 paymentTokenIx = uint8(_paymentToken);
        // ReNFT fee
        ERC20 paymentToken = ERC20(resolver.getPaymentToken(paymentTokenIx));
        paymentToken.safeTransfer(beneficiary, fee);
    }

    function distributePayments(
        LendingRenting storage _lendingRenting,
        uint256 _secondsSinceRentStart
    ) private {
        // enum to uint8
        uint8 paymentTokenIx = uint8(_lendingRenting.lending.paymentToken);
        // uint8 to paymentToken address
        address paymentToken = resolver.getPaymentToken(paymentTokenIx);
        uint256 decimals = ERC20(paymentToken).decimals();

        // lender receives amounts proportional to the amount of time the NFT was used
        uint256 scale = 10**decimals;
        uint256 nftPrice = unpackPrice(_lendingRenting.lending.nftPrice, scale);
        uint256 rentPrice = unpackPrice(
            _lendingRenting.lending.dailyRentPrice,
            scale
        );
        uint256 totalRenterPmtWoCollateral = rentPrice *
            _lendingRenting.renting.rentDuration;
        uint256 sendLenderAmt = (_secondsSinceRentStart * rentPrice) / 86400;

        require(
            totalRenterPmtWoCollateral > 0,
            "total payment wo collateral is zero"
        );
        require(sendLenderAmt > 0, "lender payment is zero");
        require(
            totalRenterPmtWoCollateral >= sendLenderAmt,
            "lender receiving more than renter pmt"
        );

        uint256 sendRenterAmt = totalRenterPmtWoCollateral - sendLenderAmt;
        require(
            sendRenterAmt < totalRenterPmtWoCollateral,
            "underflow issues prevention"
        );

        // the fee is always taken from the lender
        // the renter contributes the lump sum of all the days prepaid + collateral
        // lender is generating yield from their NFT
        // the fee is taken propotionally to the time the asset was rented
        uint256 takenFee = takeFee(
            sendLenderAmt,
            _lendingRenting.lending.paymentToken
        );

        sendLenderAmt -= takenFee;
        sendRenterAmt += nftPrice;

        ERC20(paymentToken).safeTransfer(
            _lendingRenting.lending.lenderAddress,
            sendLenderAmt
        );
        ERC20(paymentToken).safeTransfer(
            _lendingRenting.renting.renterAddress,
            sendRenterAmt
        );
    }

    function distributeClaimPayment(LendingRenting memory _lendingRenting)
        private
    {
        uint8 paymentTokenIx = uint8(_lendingRenting.lending.paymentToken);
        ERC20 paymentToken = ERC20(resolver.getPaymentToken(paymentTokenIx));

        uint256 decimals = ERC20(paymentToken).decimals();
        uint256 scale = 10**decimals;
        uint256 nftPrice = unpackPrice(_lendingRenting.lending.nftPrice, scale);
        uint256 rentPrice = unpackPrice(
            _lendingRenting.lending.dailyRentPrice,
            scale
        );
        uint256 maxRentPayment = rentPrice *
            _lendingRenting.renting.rentDuration;
        // ReNFT's fee
        uint256 takenFee = takeFee(
            maxRentPayment,
            IResolver.PaymentToken(paymentTokenIx)
        );
        uint256 finalAmt = maxRentPayment + nftPrice;

        require(maxRentPayment > 0, "maxRentPayment is zero");
        require(
            maxRentPayment == finalAmt - nftPrice,
            "maxRentPayment is incorrect"
        );

        paymentToken.safeTransfer(
            _lendingRenting.lending.lenderAddress,
            finalAmt - takenFee
        );
    }

    function safeTransfer(
        TwoPointer memory _tp,
        address _from,
        address _to
    ) private {
        if (is721(_tp.nfts[_tp.lastIx])) {
            IERC721(_tp.nfts[_tp.lastIx]).transferFrom(
                _from,
                _to,
                _tp.tokenIds[_tp.lastIx]
            );
        } else if (is1155(_tp.nfts[_tp.lastIx])) {
            IERC1155(_tp.nfts[_tp.lastIx]).safeBatchTransferFrom(
                _from,
                _to,
                sliceArr(_tp.tokenIds, _tp.lastIx, _tp.currIx),
                sliceArr(_tp.lentAmounts, _tp.lastIx, _tp.currIx),
                ""
            );
        } else {
            revert("unsupported token type");
        }
    }

    //      .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.
    // `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'

    function handleLend(TwoPointer memory _tp) private {
        // for individual tokenIds within the same 1155
        // or
        // for ERC721s
        for (uint256 i = _tp.lastIx; i < _tp.currIx; i++) {
            ensureIsLendable(_tp, i);

            LendingRenting storage item = lendingRenting[
                keccak256(
                    abi.encodePacked(
                        // no need to use i, since the nft will repeat
                        // so can access at the same memory location all the time
                        _tp.nfts[_tp.lastIx],
                        _tp.tokenIds[i],
                        // makes the whole thing unique, in case someone else turns
                        // up with the same nft and tokenId
                        lendingId
                    )
                )
            ];

            // should never happen
            ensureIsNull(item.lending);
            // sanity check
            ensureIsNull(item.renting);

            // about lentAmount
            // we have already checked that this is a valid uint8 amount in ensureIsLendable

            // about maxRentDuration
            // is a uint8 by default. The above is uint256 for convenience of batch transfers
            // the erc1155 batch transfer accepts an array of uint256. So to avoid casting, we
            // accept uint256, but check that it is uint8 in  ensureIsLendable

            bool nftIs721 = is721(_tp.nfts[i]);
            // about dailyRentPrice
            // both the dailyRentPrices and nftPrices have been checked for valid non-zero amounts
            // in the ensureIsLendable
            item.lending = Lending({
                lenderAddress: payable(msg.sender),
                lentAmount: nftIs721 ? 1 : uint8(_tp.lentAmounts[i]),
                maxRentDuration: _tp.maxRentDurations[i],
                dailyRentPrice: _tp.dailyRentPrices[i],
                nftPrice: _tp.nftPrices[i],
                paymentToken: _tp.paymentTokens[i]
            });

            emit Lent(
                _tp.nfts[_tp.lastIx],
                _tp.tokenIds[i],
                nftIs721 ? 1 : uint8(_tp.lentAmounts[i]),
                lendingId,
                msg.sender,
                _tp.maxRentDurations[i],
                _tp.dailyRentPrices[i],
                _tp.nftPrices[i],
                nftIs721,
                _tp.paymentTokens[i]
            );

            lendingId++;
        }

        // finally we transfer the NFTs from the sender to this ReNFT contract
        safeTransfer(_tp, msg.sender, address(this));
    }

    function handleRent(TwoPointer memory _tp) private {
        for (uint256 i = _tp.lastIx; i < _tp.currIx; i++) {
            LendingRenting storage item = lendingRenting[
                keccak256(
                    abi.encodePacked(
                        // no need to use i, since the nft will repeat
                        // so can access at the same memory location all the time
                        _tp.nfts[_tp.lastIx],
                        _tp.tokenIds[i],
                        _tp.lendingIds[i]
                    )
                )
            ];

            // // a lending item must exist to be able to rent it
            ensureIsNotNull(item.lending);
            // // should never happen
            ensureIsNull(item.renting);
            // // checks that requested rent duration is below the lending max rent duration
            // // that the renter is not the lender
            // // and that the rent duration is at least a day
            ensureIsRentable(item.lending, _tp, i, msg.sender);

            // from enum to uint8
            uint8 paymentTokenIx = uint8(item.lending.paymentToken);
            // from uint8 to address
            address paymentToken = resolver.getPaymentToken(paymentTokenIx);
            uint256 decimals = ERC20(paymentToken).decimals();

            {
                uint256 scale = 10**decimals;
                uint256 rentPrice = _tp.rentDurations[i] *
                    unpackPrice(item.lending.dailyRentPrice, scale);
                uint256 nftPrice = item.lending.lentAmount *
                    unpackPrice(item.lending.nftPrice, scale);

                // extra sanity checks, even though we have checked for zeros before
                require(rentPrice > 0, "rent price is zero");
                require(nftPrice > 0, "nft price is zero");

                uint256 upfrontPayment = rentPrice + nftPrice;

                // if this is an erc20 transaction - send immediately
                // lock up the lump sum in escrow
                ERC20(paymentToken).safeTransferFrom(
                    msg.sender,
                    address(this),
                    upfrontPayment
                );
            }

            item.renting.renterAddress = payable(msg.sender);
            // these are uint8s by default
            item.renting.rentDuration = _tp.rentDurations[i];
            item.renting.rentedAt = uint32(block.timestamp);

            emit Rented(
                _tp.lendingIds[i],
                msg.sender,
                _tp.rentDurations[i],
                uint32(block.timestamp)
            );
        }

        safeTransfer(_tp, address(this), msg.sender);
    }

    function handleReturn(TwoPointer memory _tp) private {
        for (uint256 i = _tp.lastIx; i < _tp.currIx; i++) {
            LendingRenting storage item = lendingRenting[
                keccak256(
                    abi.encodePacked(
                        // no need to use i, since the nft will repeat
                        // so can access at the same memory location all the time
                        _tp.nfts[_tp.lastIx],
                        _tp.tokenIds[i],
                        _tp.lendingIds[i]
                    )
                )
            ];

            // to return, there must be a lending item
            ensureIsNotNull(item.lending);
            // ensures that
            // the user returning is the renter
            // and that the return date is not yet due
            ensureIsReturnable(item.renting, msg.sender, block.timestamp);

            uint256 secondsSinceRentStart = block.timestamp -
                item.renting.rentedAt;
            distributePayments(item, secondsSinceRentStart);

            emit Returned(_tp.lendingIds[i], uint32(block.timestamp));

            delete item.renting;
        }

        // sending the NFTs back to the ReNFT contract for continuous lending
        // by default the lending continues after return so that the lender
        // does not have to re-lend after every rent
        safeTransfer(_tp, msg.sender, address(this));
    }

    function handleStopLending(TwoPointer memory _tp) private {
        for (uint256 i = _tp.lastIx; i < _tp.currIx; i++) {
            LendingRenting storage item = lendingRenting[
                keccak256(
                    abi.encodePacked(
                        // no need to use i, since the nft will repeat
                        // so can access at the same memory location all the time
                        _tp.nfts[_tp.lastIx],
                        _tp.tokenIds[i],
                        _tp.lendingIds[i]
                    )
                )
            ];

            // lending item must exist to stop lending
            ensureIsNotNull(item.lending);
            // renting must not exist to stop lending
            ensureIsNull(item.renting);
            ensureIsStoppable(item.lending, msg.sender);

            emit LendingStopped(_tp.lendingIds[i], uint32(block.timestamp));

            delete item.lending;
        }

        safeTransfer(_tp, address(this), msg.sender);
    }

    /**
     * conditions for claim
     * 1. availableAmount = 0
     * 2. isPastReturnDate
     */
    function handleClaimCollateral(TwoPointer memory _tp) private {
        for (uint256 i = _tp.lastIx; i < _tp.currIx; i++) {
            LendingRenting storage item = lendingRenting[
                keccak256(
                    abi.encodePacked(
                        _tp.nfts[_tp.lastIx],
                        _tp.tokenIds[i],
                        _tp.lendingIds[i]
                    )
                )
            ];

            // to claim the collateral, you need to have something in lending
            ensureIsNotNull(item.lending);
            // and renting
            ensureIsNotNull(item.renting);
            ensureIsClaimable(item.renting, block.timestamp);

            distributeClaimPayment(item);

            emit CollateralClaimed(_tp.lendingIds[i], uint32(block.timestamp));

            delete item.lending;
            delete item.renting;
        }
    }

    //      .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.
    // `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'

    function is721(address _nft) private view returns (bool) {
        return IERC165(_nft).supportsInterface(type(IERC721).interfaceId);
    }

    function is1155(address _nft) private view returns (bool) {
        return IERC165(_nft).supportsInterface(type(IERC1155).interfaceId);
    }

    //      .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.
    // `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'

    function createLendTP(
        address[] memory _nfts,
        uint256[] memory _tokenIds,
        uint256[] memory _lendAmounts,
        uint8[] memory _maxRentDurations,
        bytes4[] memory _dailyRentPrices,
        bytes4[] memory _nftPrices,
        IResolver.PaymentToken[] memory _paymentTokens
    ) private pure returns (TwoPointer memory tp) {
        tp = TwoPointer({
            lastIx: 0,
            currIx: 1,
            nfts: _nfts,
            tokenIds: _tokenIds,
            lentAmounts: _lendAmounts,
            lendingIds: new uint256[](0),
            rentDurations: new uint8[](0),
            maxRentDurations: _maxRentDurations,
            dailyRentPrices: _dailyRentPrices,
            nftPrices: _nftPrices,
            paymentTokens: _paymentTokens
        });
    }

    function createRentTP(
        address[] memory _nfts,
        uint256[] memory _tokenIds,
        uint256[] memory _lendAmounts,
        uint256[] memory _lendingIds,
        uint8[] memory _rentDurations
    ) private pure returns (TwoPointer memory tp) {
        tp = TwoPointer({
            lastIx: 0,
            currIx: 1,
            nfts: _nfts,
            tokenIds: _tokenIds,
            lentAmounts: _lendAmounts,
            lendingIds: _lendingIds,
            rentDurations: _rentDurations,
            maxRentDurations: new uint8[](0),
            dailyRentPrices: new bytes4[](0),
            nftPrices: new bytes4[](0),
            paymentTokens: new IResolver.PaymentToken[](0)
        });
    }

    function createActionTP(
        address[] memory _nfts,
        uint256[] memory _tokenIds,
        uint256[] memory _lendAmounts,
        uint256[] memory _lendingIds
    ) private pure returns (TwoPointer memory tp) {
        tp = TwoPointer({
            lastIx: 0,
            currIx: 1,
            nfts: _nfts,
            tokenIds: _tokenIds,
            lentAmounts: _lendAmounts,
            lendingIds: _lendingIds,
            rentDurations: new uint8[](0),
            maxRentDurations: new uint8[](0),
            dailyRentPrices: new bytes4[](0),
            nftPrices: new bytes4[](0),
            paymentTokens: new IResolver.PaymentToken[](0)
        });
    }

    function unpackPrice(bytes4 _price, uint256 _scale)
        private
        pure
        returns (uint256)
    {
        ensureIsUnpackablePrice(_price, _scale);

        // whole := if _price is 0x00120034, then whole is uint16(0x0012)
        // decimal := uint16(0x0034)
        // we only support dp4 precision for decimals. i.e. you can only have
        // numerals after the decimal place ABCD.wxyz. e.g. 1.8271
        // 1.8271 represents amount in the default scale of the payment token
        // i.e. if .decimals() of the ERC20 is 6, then 1.8271 * (10 ** 6)
        uint16 whole = uint16(bytes2(_price));
        uint16 decimal = uint16(bytes2(_price << 16));
        uint256 decimalScale = _scale / 10000;

        if (whole > 9999) {
            whole = 9999;
        }
        if (decimal > 9999) {
            decimal = 9999;
        }

        uint256 w = whole * _scale;
        uint256 d = decimal * decimalScale;
        uint256 price = w + d;

        return price;
    }

    function sliceArr(
        uint256[] memory _arr,
        uint256 _fromIx,
        uint256 _toIx
    ) private pure returns (uint256[] memory r) {
        r = new uint256[](_toIx - _fromIx);
        for (uint256 i = _fromIx; i < _toIx; i++) {
            r[i - _fromIx] = _arr[i];
        }
    }

    //      .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.
    // `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'

    function ensureIsNotZeroAddr(address _addr) private pure {
        require(_addr != address(0), "addr is a zero address");
    }

    function ensureIsZeroAddr(address _addr) private pure {
        require(_addr == address(0), "addr is not a zero address");
    }

    function ensureIsNull(Lending memory _lending) private pure {
        ensureIsZeroAddr(_lending.lenderAddress);
        require(_lending.maxRentDuration == 0, "max rent duration is zero");
        require(_lending.dailyRentPrice == 0, "daily rent price is zero");
        require(_lending.nftPrice == 0, "nft price is zero");
    }

    function ensureIsNotNull(Lending memory _lending) private pure {
        ensureIsNotZeroAddr(_lending.lenderAddress);
        require(_lending.maxRentDuration != 0, "max rent duration is zero");
        require(_lending.dailyRentPrice != 0, "daily rent price is zero");
        require(_lending.nftPrice != 0, "nft price is zero");
    }

    function ensureIsNull(Renting memory _renting) private pure {
        ensureIsZeroAddr(_renting.renterAddress);
        require(_renting.rentDuration == 0, "rent duration is not zero");
        require(_renting.rentedAt == 0, "was rented before");
    }

    function ensureIsNotNull(Renting memory _renting) private pure {
        ensureIsNotZeroAddr(_renting.renterAddress);
        require(_renting.rentDuration != 0, "rent duration is zero");
        require(_renting.rentedAt != 0, "never rented");
    }

    function ensureIsLendable(TwoPointer memory _tp, uint256 _i) private pure {
        // lending at least one token & the amount is less or equal than uint8 max 255
        require(_tp.lentAmounts[_i] > 0, "invalid lend amount");
        require(_tp.lentAmounts[_i] <= type(uint8).max, "cannot exceed uint8");
        require(
            _tp.maxRentDurations[_i] <= type(uint8).max,
            "cannot exceed uint8"
        );
        // max rent duration is at least a day. it is uint8 so no need to check for max
        require(_tp.maxRentDurations[_i] > 0, "must be at least one day lend");
        // ensure that the daily rental price and the collateral prices are not zero
        require(
            uint32(_tp.dailyRentPrices[_i]) > 0,
            "daily rent price is zero"
        );
        require(uint32(_tp.nftPrices[_i]) > 0, "nft price is zero");
    }

    function ensureIsRentable(
        Lending memory _lending,
        TwoPointer memory _tp,
        uint256 _i,
        address _msgSender
    ) private pure {
        require(_msgSender != _lending.lenderAddress, "cant rent own nft");
        require(
            _tp.rentDurations[_i] <= type(uint8).max,
            "cannot exceed uint8"
        );
        require(_tp.rentDurations[_i] > 0, "should rent for at least a day");
        require(
            _tp.rentDurations[_i] <= _lending.maxRentDuration,
            "max rent duration exceeded"
        );
    }

    function ensureIsReturnable(
        Renting memory _renting,
        address _msgSender,
        uint256 _blockTimestamp
    ) private pure {
        // only renter can return the nft
        // and the rent should not be past the due date
        require(_renting.renterAddress == _msgSender, "not renter");
        require(
            !isPastReturnDate(_renting, _blockTimestamp),
            "is past return date"
        );
    }

    function ensureIsStoppable(Lending memory _lending, address _msgSender)
        private
        pure
    {
        require(_lending.lenderAddress == _msgSender, "only lender allowed");
    }

    function ensureIsClaimable(Renting memory _renting, uint256 _blockTimestamp)
        private
        pure
    {
        require(isPastReturnDate(_renting, _blockTimestamp), "cant claim yet");
    }

    function ensureIsUnpackablePrice(bytes4 _price, uint256 _scale)
        private
        pure
    {
        require(uint32(_price) > 0, "invalid price");
        require(_scale >= 10000, "invalid scale");
    }

    //      .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.
    // `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'

    function isPastReturnDate(Renting memory _renting, uint256 _now)
        private
        pure
        returns (bool)
    {
        require(_now > _renting.rentedAt, "_now  lt _renting.rentedAt");
        return _now - _renting.rentedAt > _renting.rentDuration * 86400;
    }

    function setRentFee(uint256 _rentFee) external {
        require(msg.sender == admin, "not admin");
        require(_rentFee < 10000, "cannot be taking 100 pct fee madlad");
        rentFee = _rentFee;
    }

    function setBeneficiary(address payable _newBeneficiary) external {
        require(msg.sender == admin, "not admin");
        beneficiary = _newBeneficiary;
    }
}

//              @@@@@@@@@@@@@@@@        ,@@@@@@@@@@@@@@@@
//              @@@,,,,,,,,,,@@@        ,@@&,,,,,,,,,,@@@
//         @@@@@@@@,,,,,,,,,,@@@@@@@@&  ,@@&,,,,,,,,,,@@@@@@@@
//         @@@**********@@@@@@@@@@@@@&  ,@@@@@@@@**********@@@
//         @@@**********@@@@@@@@@@@@@&  ,@@@@@@@@**********@@@@@@@@
//         @@@**********@@@@@@@@@@@@@&       .@@@**********@@@@@@@@
//    @@@@@@@@**********@@@@@@@@@@@@@&       .@@@**********@@@@@@@@
//    @@@**********@@@@@@@@@@@@@&            .@@@@@@@@**********@@@
//    @@@**********@@@@@@@@@@@@@&            .@@@@@@@@**********@@@@@@@@
//    @@@@@@@@**********@@@@@@@@&            .@@@**********@@@@@@@@@@@@@
//    @@@@@@@@//////////@@@@@@@@&            .@@@//////////@@@@@@@@@@@@@
//         @@@//////////@@@@@@@@&            .@@@//////////@@@@@@@@@@@@@
//         @@@//////////@@@@@@@@&       ,@@@@@@@@//////////@@@@@@@@@@@@@
//         @@@%%%%%/////(((((@@@&       ,@@@(((((/////%%%%%@@@@@@@@
//         @@@@@@@@//////////@@@@@@@@&  ,@@@//////////@@@@@@@@@@@@@
//              @@@%%%%%%%%%%@@@@@@@@&  ,@@@%%%%%%%%%%@@@@@@@@@@@@@
//              @@@@@@@@@@@@@@@@@@@@@&  ,@@@@@@@@@@@@@@@@@@@@@@@@@@
//                   @@@@@@@@@@@@@@@@&        @@@@@@@@@@@@@@@@
//                   @@@@@@@@@@@@@@@@&        @@@@@@@@@@@@@@@@
