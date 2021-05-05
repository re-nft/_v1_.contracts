// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

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

contract ReNFT is IReNft {
    using SafeERC20 for IERC20;

    IResolver private resolver;
    address private admin;
    address payable private beneficiary;
    uint256 private lendingId = 1;

    uint256 public rentFee = 500;
    bytes4 private constant ERC20_DECIMALS_SELECTOR =
        bytes4(keccak256(bytes("decimals()")));

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
    ) public {
        resolver = IResolver(_resolver);
        beneficiary = _beneficiary;
        admin = _admin;
    }

    function twoPointerLoop(
        function(TwoPointer memory) f,
        TwoPointer memory _tp
    ) private {
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
        uint256[] memory _lentAmounts,
        uint256[] memory _lendingIds,
        uint8[] memory _rentDurations
    ) external payable override {
        twoPointerLoop(
            handleRent,
            createRentTP(
                _nfts,
                _tokenIds,
                _lentAmounts,
                _lendingIds,
                _rentDurations
            )
        );
    }

    function returnIt(
        address[] memory _nfts,
        uint256[] memory _tokenIds,
        uint256[] memory _lentAmounts,
        uint256[] memory _lendingIds
    ) external override {
        twoPointerLoop(
            handleReturn,
            createActionTP(_nfts, _tokenIds, _lentAmounts, _lendingIds)
        );
    }

    function stopLending(
        address[] memory _nfts,
        uint256[] memory _tokenIds,
        uint256[] memory _lentAmounts,
        uint256[] memory _lendingIds
    ) external override {
        twoPointerLoop(
            handleStopLending,
            createActionTP(_nfts, _tokenIds, _lentAmounts, _lendingIds)
        );
    }

    function claimCollateral(
        address[] memory _nfts,
        uint256[] memory _tokenIds,
        uint256[] memory _lentAmounts,
        uint256[] memory _lendingIds
    ) external override {
        twoPointerLoop(
            handleClaimCollateral,
            createActionTP(_nfts, _tokenIds, _lentAmounts, _lendingIds)
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

        if (paymentTokenIx > 1) {
            IERC20 paymentToken =
                IERC20(resolver.getPaymentToken(paymentTokenIx));
            paymentToken.safeTransfer(beneficiary, fee);
        } else {
            beneficiary.transfer(fee);
        }
    }

    function distributePayments(
        LendingRenting storage _lendingRenting,
        uint256 _secondsSinceRentStart
    ) private {
        uint256 decimals = 18;
        uint8 paymentTokenIx = uint8(_lendingRenting.lending.paymentToken);
        address paymentToken = resolver.getPaymentToken(paymentTokenIx);

        if (paymentTokenIx > 1) {
            decimals = __decimals(paymentToken);
        }

        uint256 scale = 10**decimals;
        uint256 nftPrice = unpackPrice(_lendingRenting.lending.nftPrice, scale);
        uint256 rentPrice =
            unpackPrice(_lendingRenting.lending.dailyRentPrice, scale);
        uint256 renterPayment =
            rentPrice * _lendingRenting.renting.rentDuration;
        uint256 sendLenderAmt = (_secondsSinceRentStart * rentPrice) / 86400;

        require(
            renterPayment >= sendLenderAmt,
            "lender receiving more than renter pmt"
        );

        uint256 sendRenterAmt = renterPayment - sendLenderAmt;

        require(renterPayment > sendRenterAmt, "underflow issues prevention");

        uint256 takenFee =
            takeFee(sendLenderAmt, _lendingRenting.lending.paymentToken);
        sendRenterAmt += nftPrice;

        if (paymentTokenIx > 1) {
            IERC20(paymentToken).safeTransfer(
                _lendingRenting.lending.lenderAddress,
                sendLenderAmt - takenFee
            );
            IERC20(paymentToken).safeTransfer(
                _lendingRenting.renting.renterAddress,
                sendRenterAmt
            );
        } else {
            require(paymentTokenIx == 1, "sentinels dont pay");

            _lendingRenting.lending.lenderAddress.transfer(
                sendLenderAmt - takenFee
            );
            _lendingRenting.renting.renterAddress.transfer(sendRenterAmt);
        }
    }

    function distributeClaimPayment(LendingRenting memory _lendingRenting)
        private
    {
        uint8 paymentTokenIx = uint8(_lendingRenting.lending.paymentToken);
        IERC20 paymentToken = IERC20(resolver.getPaymentToken(paymentTokenIx));

        bool isERC20 = paymentTokenIx > 1;
        uint256 decimals = 18;
        if (isERC20) {
            decimals = __decimals(address(paymentToken));
        }

        uint256 scale = 10**decimals;
        uint256 nftPrice = unpackPrice(_lendingRenting.lending.nftPrice, scale);
        uint256 rentPrice =
            unpackPrice(_lendingRenting.lending.dailyRentPrice, scale);
        uint256 maxRentPayment =
            rentPrice * _lendingRenting.renting.rentDuration;
        uint256 takenFee =
            takeFee(maxRentPayment, IResolver.PaymentToken(paymentTokenIx));
        uint256 finalAmt = maxRentPayment + nftPrice;

        if (isERC20) {
            paymentToken.safeTransfer(
                _lendingRenting.lending.lenderAddress,
                finalAmt - takenFee
            );
        } else {
            _lendingRenting.lending.lenderAddress.transfer(finalAmt - takenFee);
        }
    }

    function safeTransfer(
        TwoPointer memory _tp,
        uint256[] memory _amounts,
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
                sliceMemoryArray(_tp, _tp.tokenIds),
                sliceMemoryArray(_tp, _amounts),
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

            LendingRenting storage item =
                lendingRenting[
                    keccak256(
                        abi.encodePacked(
                            _tp.nfts[_tp.lastIx],
                            _tp.tokenIds[i],
                            _tp.lentAmounts[i],
                            _tp.lendingIds[i]
                        )
                    )
                ];

            ensureIsNull(item.lending);
            ensureIsUint8Amount(_tp.lentAmounts[i]);

            item.lending = Lending({
                lenderAddress: payable(msg.sender),
                lentAmount: uint8(_tp.lentAmounts[i]),
                maxRentDuration: _tp.maxRentDurations[i],
                dailyRentPrice: _tp.dailyRentPrices[i],
                nftPrice: _tp.nftPrices[i],
                paymentToken: _tp.paymentTokens[i]
            });

            emit Lent(
                _tp.nfts[_tp.lastIx],
                _tp.tokenIds[i],
                uint8(_tp.lentAmounts[i]),
                _tp.lendingIds[i],
                msg.sender,
                _tp.maxRentDurations[i],
                _tp.dailyRentPrices[i],
                _tp.nftPrices[i],
                is721(_tp.nfts[i]),
                _tp.paymentTokens[i]
            );

            lendingId++;
        }

        safeTransfer(_tp, _tp.lentAmounts, msg.sender, address(this));
    }

    function handleRent(TwoPointer memory _tp) private {
        uint256 ethPmtRequired = 0;

        for (uint256 i = _tp.lastIx; i < _tp.currIx; i++) {
            LendingRenting storage item =
                lendingRenting[
                    keccak256(
                        abi.encodePacked(
                            _tp.nfts[_tp.lastIx],
                            _tp.tokenIds[i],
                            _tp.lentAmounts[i],
                            _tp.lendingIds[i]
                        )
                    )
                ];

            ensureIsNull(item.renting);
            ensureIsRentable(item.lending, _tp, i, msg.sender);

            uint8 paymentTokenIndex = uint8(item.lending.paymentToken);
            address paymentToken = resolver.getPaymentToken(paymentTokenIndex);
            uint256 decimals = 18;

            {
                if (paymentTokenIndex > 1) {
                    decimals = __decimals(paymentToken);
                }
                uint256 scale = 10**decimals;
                uint256 rentPrice =
                    _tp.lentAmounts[i] *
                        _tp.rentDurations[i] *
                        unpackPrice(item.lending.dailyRentPrice, scale);
                uint256 nftPrice =
                    _tp.lentAmounts[i] *
                        unpackPrice(item.lending.nftPrice, scale);

                require(rentPrice > 0, "rent price is zero");

                uint256 upfrontPayment = rentPrice + nftPrice;
                if (paymentTokenIndex > 1) {
                    IERC20(paymentToken).safeTransferFrom(
                        msg.sender,
                        address(this),
                        upfrontPayment
                    );
                } else {
                    ethPmtRequired = ethPmtRequired + upfrontPayment;

                    require(
                        msg.value >= ethPmtRequired,
                        "insufficient eth sent"
                    );
                }
            }

            item.renting.renterAddress = payable(msg.sender);
            item.renting.rentDuration = _tp.rentDurations[i];
            item.renting.rentedAt = uint32(block.timestamp);

            emit Rented(
                _tp.nfts[_tp.lastIx],
                _tp.tokenIds[i],
                _tp.lendingIds[i],
                msg.sender,
                _tp.rentDurations[i],
                is721(_tp.nfts[_tp.lastIx]),
                uint32(block.timestamp)
            );
        }

        safeTransfer(_tp, _tp.lentAmounts, address(this), msg.sender);
    }

    function handleReturn(TwoPointer memory _tp) private {
        for (uint256 i = _tp.lastIx; i < _tp.currIx; i++) {
            LendingRenting storage item =
                lendingRenting[
                    keccak256(
                        abi.encodePacked(
                            _tp.nfts[_tp.lastIx],
                            _tp.tokenIds[i],
                            _tp.lentAmounts[i],
                            _tp.lendingIds[i]
                        )
                    )
                ];

            ensureIsReturnable(item.renting, msg.sender, block.timestamp);

            uint256 secondsSinceRentStart =
                block.timestamp - item.renting.rentedAt;
            distributePayments(item, secondsSinceRentStart);

            emit Returned(
                _tp.nfts[_tp.lastIx],
                _tp.tokenIds[i],
                _tp.lendingIds[i],
                msg.sender,
                uint32(block.timestamp)
            );

            delete item.renting;
        }
        safeTransfer(_tp, _tp.lentAmounts, msg.sender, address(this));
    }

    function handleStopLending(TwoPointer memory _tp) private {
        for (uint256 i = _tp.lastIx; i < _tp.currIx; i++) {
            LendingRenting storage item =
                lendingRenting[
                    keccak256(
                        abi.encodePacked(
                            _tp.nfts[_tp.lastIx],
                            _tp.tokenIds[i],
                            _tp.lentAmounts[i],
                            _tp.lendingIds[i]
                        )
                    )
                ];

            ensureIsNotNull(item.lending);
            ensureIsNull(item.renting);
            ensureIsStoppable(item.lending, _tp, i, msg.sender);

            delete item.lending;

            emit LendingStopped(
                _tp.nfts[_tp.lastIx],
                _tp.tokenIds[i],
                _tp.lendingIds[i],
                uint32(block.timestamp)
            );
        }

        safeTransfer(_tp, _tp.lentAmounts, address(this), msg.sender);
    }

    /**
     * conditions for claim
     * 1. availableAmount = 0
     * 2. isPastReturnDate
     */
    function handleClaimCollateral(TwoPointer memory _tp) private {
        for (uint256 i = _tp.lastIx; i < _tp.currIx; i++) {
            LendingRenting storage item =
                lendingRenting[
                    keccak256(
                        abi.encodePacked(
                            _tp.nfts[_tp.lastIx],
                            _tp.tokenIds[i],
                            _tp.lentAmounts[i],
                            _tp.lendingIds[i]
                        )
                    )
                ];

            ensureIsNotNull(item.lending);
            ensureIsNotNull(item.renting);
            ensureIsClaimable(item.renting, block.timestamp);

            distributeClaimPayment(item);

            delete item.lending;
            delete item.renting;

            emit CollateralClaimed(
                _tp.nfts[_tp.lastIx],
                _tp.tokenIds[i],
                _tp.lendingIds[i],
                uint32(block.timestamp)
            );
        }
    }

    //      .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.
    // `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        // 0xf0b9e5ba === `bytes4(keccak256("onERC721Received(address,uint256,bytes)"))`
        // 0xf0b9e5ba === `ERC721Receiver(0).onERC721Received.selector`
        return 0xf0b9e5ba;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        // bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`
        return 0xbc197c81;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        // bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)")) = 0xf23a6e61
        // ! note that single 1155 receives are not supported. So if you send something
        // ! directly, it will be forever lost
        return 0xf23a6e61;
    }

    function supportsInterface(bytes4 interfaceId)
        external
        pure
        override
        returns (bool)
    {
        return
            (interfaceId == type(IERC721Receiver).interfaceId) ||
            (interfaceId == type(IERC1155Receiver).interfaceId);
    }

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
    ) private returns (TwoPointer memory tp) {
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
        uint256[] memory _lentAmounts,
        uint256[] memory _lendingIds,
        uint8[] memory _rentDurations
    ) private returns (TwoPointer memory tp) {
        tp = TwoPointer({
            lastIx: 0,
            currIx: 1,
            nfts: _nfts,
            tokenIds: _tokenIds,
            lentAmounts: _lentAmounts,
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
        uint256[] memory _lentAmounts,
        uint256[] memory _lendingIds
    ) private returns (TwoPointer memory tp) {
        tp = TwoPointer({
            lastIx: 0,
            currIx: 1,
            nfts: _nfts,
            tokenIds: _tokenIds,
            lentAmounts: _lentAmounts,
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
        require(_scale >= 10000, "invalid scale");
        uint16 whole = uint16(bytes2(_price));
        uint16 decimal = uint16(bytes2(_price << 16));
        uint256 decimalScale = _scale / 10000;
        if (whole > 9999) {
            whole = 9999;
        }
        uint256 w = whole * _scale;
        if (decimal > 9999) {
            decimal = 9999;
        }
        uint256 d = decimal * decimalScale;
        uint256 price = w + d;
        require(price >= w, "invalid price");
        if (price == 0) {
            price = decimalScale;
        }
        return price;
    }

    function sliceMemoryArray(TwoPointer memory _tp, uint256[] memory _self)
        private
        pure
        returns (uint256[] memory r)
    {
        require(_tp.currIx <= _self.length, "not currIx le self.length");
        require(_tp.lastIx < _tp.currIx, "not lastIx le currIx");
        r = new uint256[](_self.length);
        for (uint256 i = _tp.currIx; i < _tp.lastIx; i++) {
            r[i - _tp.currIx] = _self[i];
        }
    }

    function __decimals(address _tokenAddress) private returns (uint256) {
        (bool success, bytes memory data) =
            _tokenAddress.call(abi.encodeWithSelector(ERC20_DECIMALS_SELECTOR));
        require(success, "invalid decimals call");
        uint256 decimals = abi.decode(data, (uint256));
        require(decimals > 0, "decimals cant be zero");
        return decimals;
    }

    //      .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.
    // `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'

    function ensureIsNull(Lending memory _lending) private pure {
        require(_lending.lenderAddress == address(0), "lender is zero address");
        require(_lending.maxRentDuration == 0, "max rent duration is zero");
        require(_lending.dailyRentPrice == 0, "daily rent price is zero");
        require(_lending.nftPrice == 0, "nft price is zero");
    }

    function ensureIsNotNull(Lending memory _lending) private pure {
        require(_lending.lenderAddress != address(0), "lender is zero address");
        require(_lending.maxRentDuration != 0, "max rent duration is zero");
        require(_lending.dailyRentPrice != 0, "daily rent price is zero");
        require(_lending.nftPrice != 0, "nft price is zero");
    }

    function ensureIsNull(Renting memory _renting) private pure {
        require(
            _renting.renterAddress == address(0),
            "renter address is zero address"
        );
        require(_renting.rentDuration == 0, "rent duration is zero");
        require(_renting.rentedAt == 0, "never rented");
    }

    function ensureIsNotNull(Renting memory _renting) private pure {
        require(
            _renting.renterAddress != address(0),
            "renter address is zero address"
        );
        require(_renting.rentDuration != 0, "rent duration is zero");
        require(_renting.rentedAt != 0, "never rented");
    }

    function ensureIsLendable(TwoPointer memory _tp, uint256 _i) private pure {
        require(_tp.lentAmounts[_i] > 0, "invalid lend amount");
        require(_tp.maxRentDurations[_i] > 0, "must be at least one day lend");
    }

    function ensureIsRentable(
        Lending memory _lending,
        TwoPointer memory _tp,
        uint256 _i,
        address _msgSender
    ) private pure {
        require(_msgSender != _lending.lenderAddress, "cant rent own nft");
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
        require(_renting.renterAddress == _msgSender, "not renter");
        require(
            !isPastReturnDate(_renting, _blockTimestamp),
            "is past return date"
        );
    }

    function ensureIsStoppable(
        Lending memory _lending,
        TwoPointer memory _tp,
        uint256 _i,
        address _msgSender
    ) private pure {
        require(_lending.lenderAddress == _msgSender, "only lender allowed");
        require(
            _lending.lentAmount == uint8(_tp.lentAmounts[_i]),
            "incorrect lent amounts"
        );
    }

    function ensureIsClaimable(Renting memory _renting, uint256 _blockTimestamp)
        private
        pure
    {
        require(isPastReturnDate(_renting, _blockTimestamp), "cant claim yet");
    }

    function ensureIsUint8Amount(uint256 _amount) private pure {
        require(_amount > 0, "amount is zero");
        require(_amount < 256, "amount overflow");
    }

    //      .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.     .-.
    // `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'   `._.'

    function isPastReturnDate(Renting memory _renting, uint256 _now)
        private
        pure
        returns (bool)
    {
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
