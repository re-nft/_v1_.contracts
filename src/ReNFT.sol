// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "./interfaces/IResolver.sol";
import "./interfaces/IReNFT.sol";

contract ReNFT is IReNft {
    using SafeERC20 for IERC20;

    IResolver private resolver;
    address private admin;
    address payable private beneficiary;
    uint256 private lendingId = 1;
    uint8 MAX_UINT8 = 255;

    uint256 public rentFee = 500;
    bytes4 private constant ERC20_DECIMALS_SELECTOR = bytes4(keccak256(bytes("decimals()")));

    // single storage slot: address - 160 bits, 176, 208, 240, 248, 256
    struct Lending {
        address payable lenderAddress;
        uint8 maxRentDuration;
        bytes4 dailyRentPrice;
        bytes4 nftPrice;
        uint8 lentAmount;
        uint8 availableAmount;
        IResolver.PaymentToken paymentToken;
    }

    // single storage slot: 160 bits, 176, 198, 206
    struct Renting {
        address payable renterAddress;
        uint8 rentDuration;
        uint32 rentedAt;
        uint8 rentedAmount;
    }

    struct LendingRenting {
        Lending lending;
        Renting renting;
    }

    struct TwoPointer {
        uint256 lastIx;
        uint256 currIx;
        address[] nft;
        uint256[] tokenIds;
        uint256[] lendingIds;
        uint256[] lentAmounts;
        uint256[] otherAmounts;
    }

    struct TwoPointerItem {
        uint256 lastIx;
        uint256 currIx;
        address nft;
        uint256 tokenId;
        uint256 lendingId;
        uint256 lentAmount;
        uint256 otherAmount;
    }

    // 32 bytes key to 64 bytes struct
    mapping(bytes32 => LendingRenting) private lendingRenting;

    constructor(
        address _resolver,
        address payable _beneficiary,
        address _admin
    ) {
        resolver = IResolver(_resolver);
        beneficiary = _beneficiary;
        admin = _admin;
    }

    function lend(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _amounts,
        uint8[] memory _maxRentDuration,
        bytes4[] memory _dailyRentPrice,
        bytes4[] memory _nftPrice,
        IResolver.PaymentToken[] memory _paymentToken
    ) external override  {
        TwoPointer memory tp = TwoPointer({
            lastIx: 0,
            currIx: 1,
            nft: _nft,
            tokenIds: _tokenId,
            lendingIds: _tokenId,
            lentAmounts: _amounts,
            otherAmounts: _amounts
        });
        twoPointerLoop(handleLend, tp);
    }

    function rent(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint8[] memory _lentAmounts,
        uint256[] memory _rentAmounts,
        uint256[] memory _id,
        uint8[] memory _rentDuration
    ) external payable override  {
        TwoPointer memory tp = TwoPointer({
          lastIx: 0,
          currIx: 1,
          nft: _nft,
          tokenId: _tokenId,
          lendingIds: _id,
          lentAmounts: _lentAmounts,
          otherAmounts: _rentAmounts
        });
        twoPointerLoop(handleRent, tp);
    }

    function returnIt(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _lentAmounts,
        // TODO: require(< 256)
        uint256[] memory _rentAmounts,
        uint256[] memory _id
    ) external override  {
        TwoPointer memory tp = TwoPointer({
          lastIx: 0,
          currIx: 1,
          nft: _nft,
          tokenIds: _tokenId,
          lendingIds: _id,
          lentAmounts: _lentAmounts,
          otherAmounts: _rentAmounts
        });
        twoPointerLoop(handleReturn, tp);
    }

    function stopLending(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _lentAmounts,
        uint256[] memory _stopAmounts,
        uint256[] memory _id
    ) external override  {
        true;
        // for (uint256 i = 0; i < _nft.length; i++) {
        //     LendingRenting storage item = lendingRenting[keccak256(abi.encodePacked(_nft[i], _tokenId[i], _lentAmounts[i], _id[i]))];

        //     _ensureIsNull(item.renting);

        //     require(item.lending.lenderAddress == msg.sender, "only lender allowed");

        //     _safeTransfer(_lastIx, _currIx, address(this), msg.sender, _nft, _tokenId, _lentAmounts);

        //     delete item.lending;

        //     emit LendingStopped(_nft[i], _tokenId[i], _lentAmounts[i], _id[i], uint32(block.timestamp));
        // }
    }

    function claimCollateral(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _lentAmounts,
        uint256[] memory _claimAmounts,
        uint256[] memory _id
    ) external override  {
        TwoPointer memory tp = TwoPointer({
          lastIx: 0,
          currIx: 1,
          nft: _nft,
          tokenIds: _tokenId,
          lendingIds: _id,
          lentAmounts: _lentAmounts,
          otherAmounts: _claimAmounts
        });
        twoPointerLoop(handleClaimCollateral, tp);
    }

    function handleLend(
        TwoPointer memory _tp,
        uint8[] memory _maxRentDuration,
        bytes4[] memory _dailyRentPrice,
        bytes4[] memory _nftPrice,
        IResolver.PaymentToken[] memory _paymentToken
    ) private {
        for (uint256 i = _tp.lastIx; i < _tp.currIx; i++) {
            emitLend(
                _tp.nft[i],
                _tp.tokenIds[i],
                uint8(_tp.lentAmounts[i]),
                _maxRentDuration[i],
                _dailyRentPrice[i],
                _nftPrice[i],
                _paymentToken[i]
            );
        }
        safeTransfer(_tp, msg.sender, address(this));
    }

    function emitLend(
        TwoPointerItem memory _tp,
        uint8[] memory _maxRentDuration,
        bytes4[] memory _dailyRentPrice,
        bytes4[] memory _nftPrice,
        IResolver.PaymentToken[] memory _paymentToken
    ) private {
        // will only occur if someone passed an amount greater than uint8. i.e. >= 256
        require(_amount > 0, "invalid lend amount");
        require(_maxRentDuration > 0, "must be at least one day lend");

        bytes32 itemHash = keccak256(abi.encodePacked(_nft, _tokenId, _amount, lendingId));
        LendingRenting storage item = lendingRenting[itemHash];
        item.lending = Lending({
            lenderAddress: payable(msg.sender),
            lentAmount: _amount,
            availableAmount: _amount,
            maxRentDuration: _maxRentDuration,
            dailyRentPrice: _dailyRentPrice,
            nftPrice: _nftPrice,
            paymentToken: _paymentToken
        });
        emit Lent(
            _nft,
            _tokenId,
            _amount,
            lendingId,
            msg.sender,
            _maxRentDuration,
            _dailyRentPrice,
            _nftPrice,
            _isERC721(_nft),
            _paymentToken
        );
        lendingId++;
    }

    function handleRent(
        TwoPointer memory _tp,
        uint8[] memory _rentDuration
    ) private {
        uint256 ethPmtRequired = 0;

        for (uint256 i = _lastIx; i < _currIx; i++) {
            LendingRenting storage item = lendingRenting[keccak256(abi.encodePacked(_nft, _tokenId[i], _lentAmounts[i], _id[i]))];

            ensureIsNull(item.renting);
            // TODO: extract into an ensure
            require(msg.sender != item.lending.lenderAddress, "cant rent own nft");
            require(_rentAmounts[i] <= MAX_UINT8, "invalid rent amount");
            require(_rentDuration[i] > 0, "should rent for at least a day");
            require(_rentDuration[i] <= item.lending.maxRentDuration, "max rent duration exceeded");
            require(item.lending.availableAmount >= _rentAmounts[i], "not enough nfts to rent");

            uint8 paymentTokenIndex = uint8(item.lending.paymentToken);
            address paymentToken = resolver.getPaymentToken(paymentTokenIndex);
            uint256 decimals = 18;

            {
            if (paymentTokenIndex > 1) {
                decimals = _decimals(paymentToken);
            }
            uint256 scale = 10**decimals;
            uint256 rentPrice = _rentAmounts[i] * _rentDuration[i] * _unpackPrice(item.lending.dailyRentPrice, scale);
            uint256 nftPrice = _rentAmounts[i] * _unpackPrice(item.lending.nftPrice, scale);
            require(rentPrice > 0, "rent price is zero");
            uint256 upfrontPayment = rentPrice + nftPrice;
            if (paymentTokenIndex > 1) {
                IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), upfrontPayment);
            } else {
                ethPmtRequired = ethPmtRequired + upfrontPayment;
                require(msg.value >= ethPmtRequired, "insufficient eth sent");
            }
            }

            item.renting.renterAddress = payable(msg.sender);
            item.renting.rentDuration = _rentDuration[i];
            item.renting.rentedAt = uint32(block.timestamp);
            item.renting.rentedAmount = uint8(_rentAmounts[i]);
            item.lending.availableAmount = item.lending.availableAmount - uint8(_rentAmounts[i]);

            {
            bool is721 = _isERC721(_nft);
            uint8 rentAmount = uint8(_rentAmounts[i]);
            emit Rented(
                _nft,
                _tokenId[i],
                rentAmount,
                _id[i],
                msg.sender,
                _rentDuration[i],
                is721,
                uint32(block.timestamp)
            );
            }
        }

        safeTransfer(_tp, address(this), msg.sender);
    }

    function takeFee(uint256 _rent, IResolver.PaymentToken _paymentToken) private returns (uint256 fee) {
        fee = _rent * rentFee;
        fee /= 10000; // percentages
        uint8 paymentTokenIx = uint8(_paymentToken);

        if (paymentTokenIx > 1) {
            IERC20 paymentToken = IERC20(resolver.getPaymentToken(paymentTokenIx));
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
        bool isERC20 = paymentTokenIx > 1;

        if (isERC20) {
            decimals = decimals(paymentToken);
        }

        uint256 scale = 10**decimals;
        uint256 nftPrice = unpackPrice(_lendingRenting.lending.nftPrice, scale);
        uint256 rentPrice = unpackPrice(_lendingRenting.lending.dailyRentPrice, scale);
        uint256 renterPayment = rentPrice * _lendingRenting.renting.rentDuration;
        uint256 sendLenderAmt = (_secondsSinceRentStart * rentPrice) / 86400;

        require(renterPayment >= sendLenderAmt, "lender receiving more than renter pmt");

        uint256 sendRenterAmt = renterPayment - sendLenderAmt;

        require(renterPayment > sendRenterAmt, "underflow issues prevention");

        uint256 takenFee = takeFee(sendLenderAmt, _lendingRenting.lending.paymentToken);
        sendRenterAmt += nftPrice;

        if (isERC20) {
            IERC20(paymentToken).safeTransfer(_lendingRenting.lending.lenderAddress, sendLenderAmt - takenFee);
            IERC20(paymentToken).safeTransfer(_lendingRenting.renting.renterAddress, sendRenterAmt);
        } else {
            require(paymentTokenIx == 1, "sentinels dont pay");

            _lendingRenting.lending.lenderAddress.transfer(sendLenderAmt - takenFee);
            _lendingRenting.renting.renterAddress.transfer(sendRenterAmt);
        }
    }

    function twoPointerLoop(
        function (
            TwoPointer memory
        ) f,
        TwoPointer memory _tp
    ) private {
        if (_tp.nft.length < 2) {
            f(_tp);
            return;
        }
        while (_tp.currIx < _tp.nft.length) {
            if ((_tp.nft[_tp.lastIx] == _tp.nft[_tp.currIx]) && (is1155(_tp.nft[_tp.currIx]))) {
                _tp.currIx++;
                continue;
            }
            f(_tp);
            _tp.lastIx = _tp.currIx;
            _tp.currIx++;
        }
        f(_tp);
    }

    function handleReturn(TwoPointer memory _tp) private {
        for (uint256 i = _tp.lastIx; i < _tp.currIx; i++) {
            // TODO
            // ! if two different people rent same amounts of the same lendingId, trouble below
            // ! each renting must have an id as well. LendingRenting is no longer one lending and one renting
            // ! but one lending and multiple renting whose rentedAmounts sum is equal or less than the lending's
            // ! lentAmount
            LendingRenting storage item = lendingRenting[keccak256(
                abi.encodePacked(
                    _tp.nft[_tp.lastIx],
                    _tp.tokenIds[i],
                    _tp.lentAmounts[i],
                    _tp.lendingIds[i]
                )
            )];
            // TODO: extrat into ensure
            require(item.renting.renterAddress == msg.sender, "not renter");
            require(!isPastReturnDate(item.renting, block.timestamp), "is past return date");
            require(_tp.lentAmounts[i] <= MAX_UINT8, "lent amounts out of bounds");
            require(_tp.otherAmounts[i] <= MAX_UINT8, "return amounts out of bounds");

            uint256 secondsSinceRentStart = block.timestamp - item.renting.rentedAt;
            distributePayments(item, secondsSinceRentStart);

            emit Returned(
              _tp.nft[_tp.lastIx],
              _tp.tokenIds[i],
              uint8(_tp.lentAmounts[i]),
              _tp.lendingIds[i],
              msg.sender,
              uint32(block.timestamp)
            );

            // TODO: only delete if lentAmounts equals rentedAmounts
            delete item.renting;
        }
        safeTransfer(_tp, msg.sender, address(this));
    }

    function _handleClaimCollateral(
        uint256 _lastIx,
        uint256 _currIx,
        address _nft,
        uint256[] memory _tokenId,
        uint256[] memory _lentAmounts,
        uint256[] memory _claimAmounts,
        uint256[] memory _id
    ) private {
        for (uint256 i = 0; i < _tokenId.length; i++) {
            LendingRenting storage item = lendingRenting[keccak256(abi.encodePacked(_nft, _tokenId[i], _lentAmounts[i], _id[i]))];

            require(_lentAmounts[i] <= MAX_UINT8, "lent amounts overflow");
            require(_claimAmounts[i] <= MAX_UINT8, "claim amounts overflow");
            require(_isPastReturnDate(item.renting, block.timestamp), "cant claim yet");
            require(item.lending.lentAmount >= _claimAmounts[i], "not enough to claim");
            require(item.renting.rentedAmount >= _claimAmounts[i], "renter has not rented this many");
            _ensureIsNotNull(item.lending);
            _ensureIsNotNull(item.renting);
            // * sends the claim amounts.
            // TODO: ensure that it is proportional to the amounts
            _distributeClaimPayment(item);

            // TODO: each lending can now have multiple rentings!
            uint8 newAvailableAmount = item.lending.lentAmount - uint8(_claimAmounts[i]);
            uint8 newRentAmount = item.renting.rentedAmount - uint8(_claimAmounts[i]);

            if (newRentAmount == 0) {
                delete item.renting;
            } else {
                item.renting.rentedAmount = newRentAmount;
            }
            if (newAvailableAmount == 0) {
                delete item.lending;
            } else {
                item.lending.availableAmount = newAvailableAmount;
            }

            emit CollateralClaimed(_nft, _tokenId[i], uint8(_claimAmounts[i]), _id[i], uint32(block.timestamp));
        }
    }

    function _distributeClaimPayment(LendingRenting memory _lendingRenting) private {
        uint8 paymentTokenIx = uint8(_lendingRenting.lending.paymentToken);
        IERC20 paymentToken = IERC20(resolver.getPaymentToken(paymentTokenIx));

        bool isERC20 = paymentTokenIx > 1;
        uint256 decimals = 18;
        if (isERC20) {
            decimals = _decimals(address(paymentToken));
        }

        uint256 scale = 10**decimals;
        uint256 nftPrice = _unpackPrice(_lendingRenting.lending.nftPrice, scale);
        uint256 rentPrice = _unpackPrice(_lendingRenting.lending.dailyRentPrice, scale);
        uint256 maxRentPayment = rentPrice * _lendingRenting.renting.rentDuration;
        uint256 takenFee = _takeFee(maxRentPayment, IResolver.PaymentToken(paymentTokenIx));
        uint256 finalAmt = maxRentPayment + nftPrice;

        if (isERC20) {
            paymentToken.safeTransfer(_lendingRenting.lending.lenderAddress, finalAmt - takenFee);
        } else {
            _lendingRenting.lending.lenderAddress.transfer(finalAmt - takenFee);
        }
    }

    function safeTransfer(
        TwoPointer memory _tp,
        address _from,
        address _to
    ) private {
        if (_isERC721(_tp.nft[_tp.lastIx])) {
            IERC721(_tp.nft[_tp.lastIx])
                .transferFrom(
                    _from,
                    _to,
                    _tp.tokenIds[_tp.lastIx]
                );
        } else if (_isERC1155(_tp.nft[_tp.lastIx])) {
            IERC1155(_tp.nft[_tp.lastIx])
                .safeBatchTransferFrom(
                    _from,
                    _to,
                    _sliceMemoryArray(_tp, _tp.tokenIds),
                    _sliceMemoryArray(_tp, _tp.otherAmounts),
                    ""
                );
        } else {
            revert("unsupported token type");
        }
    }

    // -----------------------

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

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return
            (interfaceId == type(IERC721Receiver).interfaceId) || (interfaceId == type(IERC1155Receiver).interfaceId);
    }

    function isERC721(address _nft) private view returns (bool) {
        return IERC165(_nft).supportsInterface(type(IERC721).interfaceId);
    }

    function isERC1155(address _nft) private view returns (bool) {
        return IERC165(_nft).supportsInterface(type(IERC1155).interfaceId);
    }

    function unpackPrice(bytes4 _price, uint256 _scale) private pure returns (uint256) {
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

    function sliceMemoryArray(
        TwoPointer memory _tp,
        uint256[] memory _self
    ) private pure returns (uint256[] memory r) {
        require(_tp.currIx <= _self.length, "not currIx le self.length");
        require(_tp.lastIx < _tp.currIx, "not lastIx le currIx");

        r = new uint256[](_self.length);
        for (uint256 i = _tp.currIx; i < _tp.lastIx; i++) {
            r[i - _tp.currIx] = _self[i];
        }
    }

    function decimals(address _tokenAddress) private returns (uint256) {
        (bool success, bytes memory data) = _tokenAddress.call(abi.encodeWithSelector(ERC20_DECIMALS_SELECTOR));
        require(success, "invalid decimals call");
        uint256 decimals = abi.decode(data, (uint256));
        require(decimals > 0, "decimals cant be zero");
        return decimals;
    }

    function _ensureIsNotNull(Lending memory _lending) private pure {
        require(_lending.lenderAddress != address(0), "lender is zero address");
        require(_lending.maxRentDuration != 0, "max rent duration is zero");
        require(_lending.dailyRentPrice != 0, "daily rent price is zero");
        require(_lending.nftPrice != 0, "nft price is zero");
    }

    function ensureIsNotNull(Renting memory _renting) private pure {
        require(_renting.renterAddress != address(0), "renter address is zero address");
        require(_renting.rentDuration != 0, "rent duration is zero");
        require(_renting.rentedAt != 0, "never rented");
    }

    function isPastReturnDate(Renting memory _renting, uint256 _now) private pure returns (bool) {
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
