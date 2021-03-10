// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./Resolver.sol";

// - TODO: erc1155 amounts not supported in this version
// adding the amounts, would imply that lending struct would
// become two single storage slots, since it only has 4 bits
// of free space.
// - TODO: erc1155 batch transfers not supported in this version
contract RentNft is ReentrancyGuard, ERC721Holder, ERC1155Receiver {
    using SafeERC20 for ERC20;
    uint256 private lendingId = 1;
    uint256 public rentFee = 500;
    Resolver private resolver;
    address payable private beneficiary;
    address private admin;

    // * quick test showed that LentBatch with arrays
    // would cost more than the non-array version
    // like the below
    event Lent(
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 lendingId,
        address indexed lenderAddress,
        uint16 maxRentDuration,
        bytes4 dailyRentPrice,
        bytes4 nftPrice,
        Resolver.PaymentToken paymentToken
    );

    event Rented(
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 lendingId,
        address indexed renterAddress,
        uint16 rentDuration,
        uint32 rentedAt
    );

    event Returned(
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 indexed lendingId,
        address renterAddress,
        uint32 returnedAt
    );

    event CollateralClaimed(
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 indexed lendingId,
        uint32 claimedAt
    );

    event LendingStopped(
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 indexed lendingId,
        uint32 stoppedAt
    );

    struct Lending {
        // 160 bits
        address payable lenderAddress;
        // 176 bits
        uint16 maxRentDuration;
        // 208 bits
        bytes4 dailyRentPrice;
        // 240 bits
        bytes4 nftPrice;
        // 248 bits
        Resolver.PaymentToken paymentToken;
    }

    // gimme more brother
    struct Renting {
        // 160 bits
        address payable renterAddress;
        // 176 bits
        uint16 rentDuration;
        // 198 bits
        uint32 rentedAt;
    }

    struct LendingRenting {
        Lending lending;
        Renting renting;
    }

    // the stack Houdini
    struct RentCutie {
        uint256 tokenId;
        uint256 lendingId;
        address nft;
        uint256 ethPmtRequired;
        uint16 rentDuration;
        uint256 decimals;
        uint8 paymentTokenIndex;
        uint256 scale;
        address paymentToken;
        bool isERC20;
        uint256 rentPrice;
        uint256 nftPrice;
        uint256 upfrontPayment;
        uint256 nftLen;
        uint256 amount;
    }

    // 32 bytes key to 64 bytes struct
    mapping(bytes32 => LendingRenting) private lendingRenting;

    constructor(
        address _resolver,
        address payable _beneficiary,
        address _admin
    ) {
        resolver = Resolver(_resolver);
        beneficiary = _beneficiary;
        admin = _admin;
    }

    // gitcoin bounty: wrapper on top of these, to calculate the most
    // efficient way to lend & rent.
    // whether it is to call lend1155 or lendBatch1155 or a combination
    function lend(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint16[] memory _maxRentDuration,
        bytes4[] memory _dailyRentPrice,
        bytes4[] memory _nftPrice,
        Resolver.PaymentToken[] memory _paymentToken
    ) external nonReentrant {
        require(_nft.length == _tokenId.length, "_nft.length != _tokenId.length");
        require(_tokenId.length == _maxRentDuration.length, "_tokenId.length != _maxRentDuration.length");
        require(_maxRentDuration.length == _dailyRentPrice.length, "_maxRentDuration.length != _dailyRentPrice.length");
        require(_nftPrice.length == _paymentToken.length, "_nftPrice.length != _paymentToken.length");

        for (uint256 i = 0; i < _nft.length; i++) {
            require(_maxRentDuration[i] > 0, "must be at least one day lend");
            require(_maxRentDuration[i] <= 1825, "must be less than five years");

            _safeTransfer(msg.sender, address(this), _nft[i], _tokenId[i]);

            bytes32 itemHash = keccak256(abi.encodePacked(_nft[i], _tokenId[i], lendingId));
            LendingRenting storage item = lendingRenting[itemHash];

            item.lending = Lending({
                lenderAddress: payable(msg.sender),
                maxRentDuration: _maxRentDuration[i],
                dailyRentPrice: _dailyRentPrice[i],
                nftPrice: _nftPrice[i],
                paymentToken: _paymentToken[i]
            });

            emit Lent(
                _nft[i],
                _tokenId[i],
                lendingId,
                msg.sender,
                _maxRentDuration[i],
                _dailyRentPrice[i],
                _nftPrice[i],
                _paymentToken[i]
            );

            // changing from non-zero to something else costs 5000 gas
            // however, changing from zero to something else costs 20k gas
            lendingId++;
        }
    }

    function rent(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id,
        uint16[] memory _rentDuration
    ) external payable nonReentrant {
        require(_nft.length == _tokenId.length, "_nft.length != _tokenId.length");
        require(_tokenId.length == _id.length, "_tokenId.length != _id.length");
        require(_id.length == _rentDuration.length, "_id.length != _rentDuration.length");

        RentCutie memory rc;
        rc.ethPmtRequired = 0;
        rc.nftLen = _nft.length - 1;

        for (uint256 i = 0; i < _nft.length; i++) {
            rc.nft = _nft[i];
            rc.tokenId = _tokenId[i];
            rc.lendingId = _id[i];

            LendingRenting storage item = lendingRenting[keccak256(abi.encodePacked(rc.nft, rc.tokenId, rc.lendingId))];

            _ensureIsNull(item.renting);
            require(msg.sender != item.lending.lenderAddress, "cant rent own nft");

            rc.rentDuration = _rentDuration[i];

            require(rc.rentDuration > 0, "should rent for at least a day");
            require(rc.rentDuration <= item.lending.maxRentDuration, "max rent duration exceeded");

            rc.decimals = 18;
            rc.paymentTokenIndex = uint8(item.lending.paymentToken);
            rc.paymentToken = resolver.getPaymentToken(rc.paymentTokenIndex);
            rc.isERC20 = rc.paymentTokenIndex > 1;

            if (rc.isERC20) {
                rc.decimals = ERC20(rc.paymentToken).decimals();
            }

            rc.scale = 10**rc.decimals;
            rc.rentPrice = rc.rentDuration * _unpackPrice(item.lending.dailyRentPrice, rc.scale); // max is 1825 * 65535. Nowhere near the overflow
            rc.nftPrice = _unpackPrice(item.lending.nftPrice, rc.scale);

            require(rc.rentPrice > 0, "rent price is zero");

            rc.upfrontPayment = rc.rentPrice + rc.nftPrice;

            if (rc.isERC20) {
                ERC20(rc.paymentToken).safeTransferFrom(msg.sender, address(this), rc.upfrontPayment);
            } else {
                rc.ethPmtRequired += rc.upfrontPayment;
            }

            if (i == rc.nftLen) {
                require(msg.value == rc.ethPmtRequired, "insufficient amount");
            }

            item.renting.renterAddress = payable(msg.sender);
            item.renting.rentDuration = rc.rentDuration;
            item.renting.rentedAt = uint32(block.timestamp);

            _safeTransfer(address(this), msg.sender, rc.nft, rc.tokenId);

            emit Rented(rc.nft, rc.tokenId, rc.lendingId, msg.sender, rc.rentDuration, uint32(block.timestamp));
        }
    }

    function _takeFee(uint256 _rent, Resolver.PaymentToken _paymentToken) private returns (uint256 fee) {
        fee = _rent * rentFee;
        fee /= 10000; // percentages
        uint8 paymentTokenIx = uint8(_paymentToken);

        if (paymentTokenIx > 1) {
            ERC20 paymentToken = ERC20(resolver.getPaymentToken(paymentTokenIx));
            paymentToken.safeTransfer(beneficiary, fee);
        } else {
            beneficiary.transfer(fee);
        }
    }

    /**
     * Gets called only when the NFT is returned.
     * _takeFee is here and in distributeClaimPayments
     */
    function _distributePayments(LendingRenting storage _lendingRenting, uint256 _secondsSinceRentStart) private {
        uint256 decimals = 18;
        uint8 paymentTokenIx = uint8(_lendingRenting.lending.paymentToken);
        address paymentToken = resolver.getPaymentToken(paymentTokenIx);
        bool isERC20 = paymentTokenIx > 1;

        if (isERC20) {
            decimals = ERC20(paymentToken).decimals();
        }

        uint256 scale = 10**decimals;
        uint256 nftPrice = _unpackPrice(_lendingRenting.lending.nftPrice, scale);
        uint256 rentPrice = _unpackPrice(_lendingRenting.lending.dailyRentPrice, scale);
        uint256 renterPayment = rentPrice * _lendingRenting.renting.rentDuration;
        uint256 sendLenderAmt = (_secondsSinceRentStart * rentPrice) / 86400;

        require(renterPayment >= sendLenderAmt, "lender receiving more than renter pmt");

        uint256 sendRenterAmt = renterPayment - sendLenderAmt;

        require(renterPayment > sendRenterAmt, "underflow issues prevention");

        uint256 takenFee = _takeFee(sendLenderAmt, _lendingRenting.lending.paymentToken);
        sendRenterAmt += nftPrice;

        if (isERC20) {
            ERC20(paymentToken).safeTransfer(_lendingRenting.lending.lenderAddress, sendLenderAmt - takenFee);
            ERC20(paymentToken).safeTransfer(_lendingRenting.renting.renterAddress, sendRenterAmt);
        } else {
            require(paymentTokenIx == 1, "sentinels dont pay");

            _lendingRenting.lending.lenderAddress.transfer(sendLenderAmt - takenFee);
            _lendingRenting.renting.renterAddress.transfer(sendRenterAmt);
        }
    }

    function _distributeClaimPayment(LendingRenting memory _lendingRenting) private {
        uint256 decimals = 18;
        uint8 paymentTokenIx = uint8(_lendingRenting.lending.paymentToken);
        ERC20 paymentToken = ERC20(resolver.getPaymentToken(paymentTokenIx));

        bool isERC20 = paymentTokenIx > 1;

        if (isERC20) {
            decimals = paymentToken.decimals();
        }

        uint256 scale = 10**decimals;
        uint256 nftPrice = _unpackPrice(_lendingRenting.lending.nftPrice, scale);
        uint256 rentPrice = _unpackPrice(_lendingRenting.lending.dailyRentPrice, scale);
        uint256 maxRentPayment = rentPrice * _lendingRenting.renting.rentDuration;
        uint256 takenFee = _takeFee(maxRentPayment, Resolver.PaymentToken(paymentTokenIx));
        uint256 finalAmt = maxRentPayment + nftPrice;

        if (isERC20) {
            paymentToken.safeTransfer(_lendingRenting.lending.lenderAddress, finalAmt - takenFee);
        } else {
            _lendingRenting.lending.lenderAddress.transfer(finalAmt - takenFee);
        }
    }

    function returnIt(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id
    ) public nonReentrant {
        for (uint256 i = 0; i < _nft.length; i++) {
            LendingRenting storage item = lendingRenting[keccak256(abi.encodePacked(_nft[i], _tokenId[i], _id[i]))];

            require(item.renting.renterAddress == msg.sender, "not renter");

            uint256 blockTimestamp = block.timestamp;
            bool isPastReturn = _isPastReturnDate(item.renting, blockTimestamp);
            require(!isPastReturn, "is past return date");

            uint256 secondsSinceRentStart = blockTimestamp - item.renting.rentedAt;

            _safeTransfer(msg.sender, address(this), _nft[i], _tokenId[i]);

            _distributePayments(item, secondsSinceRentStart);

            emit Returned(_nft[i], _tokenId[i], _id[i], msg.sender, uint32(block.timestamp));

            delete item.renting;
        }
    }

    function claimCollateral(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id
    ) public nonReentrant {
        for (uint256 i = 0; i < _nft.length; i++) {
            LendingRenting storage item = lendingRenting[keccak256(abi.encodePacked(_nft[i], _tokenId[i], _id[i]))];

            require(_isPastReturnDate(item.renting, block.timestamp), "cant claim yet");
            _ensureIsNotNull(item.lending);
            _ensureIsNotNull(item.renting);
            _distributeClaimPayment(item);

            delete item.lending;
            delete item.renting;

            emit CollateralClaimed(_nft[i], _tokenId[i], _id[i], uint32(block.timestamp));
        }
    }

    function stopLending(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id
    ) public {
        for (uint256 i = 0; i < _nft.length; i++) {
            LendingRenting storage item = lendingRenting[keccak256(abi.encodePacked(_nft[i], _tokenId[i], _id[i]))];

            _ensureIsNull(item.renting);

            require(item.lending.lenderAddress == msg.sender, "only lender allowed");

            _safeTransfer(address(this), msg.sender, _nft[i], _tokenId[i]);

            delete item.lending;

            emit LendingStopped(_nft[i], _tokenId[i], _id[i], uint32(block.timestamp));
        }
    }

    function _safeTransfer(
        address _from,
        address _to,
        address _nft,
        uint256 _tokenId
    ) private {
        // TODO: check if this sig supports 721 receive, same for 1155
        if (IERC165(_nft).supportsInterface(0x80ac58cd)) {
            IERC721(_nft).safeTransferFrom(_from, _to, _tokenId);
        } else if (IERC165(_nft).supportsInterface(0xd9b67a26)) {
            IERC1155(_nft).safeTransferFrom(_from, _to, _tokenId, 1, "");
        } else {
            revert("unsupported nft safe transfer");
        }
    }

    // ERC1155 Received and BatchReceived is supported

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
        return 0xf23a6e61;
    }

    // Utils

    /**
     * @param _scale - if 18 decimal places, then should 1000000000000000000
     */
    function _unpackPrice(bytes4 _price, uint256 _scale) internal pure returns (uint256) {
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

    // Sanity checks section

    function _ensureIsNotNull(Lending memory _lending) private pure {
        require(_lending.lenderAddress != address(0), "lender is zero address");
        require(_lending.maxRentDuration != 0, "max rent duration is zero");
        require(_lending.dailyRentPrice != 0, "daily rent price is zero");
        require(_lending.nftPrice != 0, "nft price is zero");
    }

    function _ensureIsNotNull(Renting memory _renting) private pure {
        require(_renting.renterAddress != address(0), "renter address is zero address");
        require(_renting.rentDuration != 0, "rent duration is zero");
        require(_renting.rentedAt != 0, "never rented");
    }

    function _ensureIsNull(Renting memory _renting) private pure {
        require(_renting.renterAddress == address(0), "renter address is not zero address");
        require(_renting.rentDuration == 0, "rent duration is not zero");
        require(_renting.rentedAt == 0, "is rented");
    }

    function _isPastReturnDate(Renting memory _renting, uint256 _now) private pure returns (bool) {
        return _now - _renting.rentedAt > _renting.rentDuration * 86400;
    }

    // Admin only section

    function setRentFee(uint256 _rentFee) external {
        require(msg.sender == admin, "");
        require(_rentFee < 10000, "cannot be taking 100 pct fee");
        rentFee = _rentFee;
    }

    function setBeneficiary(address payable _newBeneficiary) external {
        require(msg.sender == admin, "");
        beneficiary = _newBeneficiary;
    }
}
