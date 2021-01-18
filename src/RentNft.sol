// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.8.0;
// import "./ChiGasSaver.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./Resolver.sol";
import "hardhat/console.sol";

contract RentNft is ReentrancyGuard, Ownable, ERC721Holder {
    using SafeERC20 for ERC20;
    // 256 bits -> 32 bytes
    // address - 20 byte value -> 160 bits
    uint256 private id = 1;
    // settable by owner and chargeable on the final rent price
    uint256 public rentFee = 500;
    // option 1 - transfer fee amounts on every txn
    //          - +: easy implementation
    //          - -: extra 20k gas cost for the sender
    // option 2 - transfer fee amounts on the front-end
    //          - +: easy but not as the above
    //          - -: same cost, if not higher
    // option 3 - intricate tracking of the amounts
    //          - and allowing the onlyOwner to withdraw
    //          - not more than those amounts
    //          - ?: no extra overhead for the returner / claimer, however
    //          - I have a feeling that tracking will more than "make up"
    //          - the "saved" 20k gas. At the very least 32 byte
    //          - chunks will be required to track all the mentioned info
    //          - that means that at least 40k gas will need to be spent
    //          ? shittiest option
    // conclusion: I proceed with option 1.
    Resolver private resolver;
    address payable private beneficiary;

    event Lent(
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 lendingId,
        address indexed lenderAddress,
        uint16 maxRentDuration,
        uint32 dailyRentPrice,
        uint32 nftPrice,
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

    struct RentCutie {
        uint256 tokenId;
        uint256 id;
        IERC721 nft;
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
    }

    // 32 bytes key to 64 bytes struct
    mapping(bytes32 => LendingRenting) private lendingRenting;

    constructor(Resolver _resolver, address payable _beneficiary) {
        resolver = _resolver;
        beneficiary = _beneficiary;
    }

    function lend(
        IERC721[] memory _nft,
        uint256[] memory _tokenId,
        uint16[] memory _maxRentDuration,
        uint32[] memory _dailyRentPrice,
        uint32[] memory _nftPrice,
        Resolver.PaymentToken[] memory _paymentToken
    ) external nonReentrant {
        require(_nft.length == _tokenId.length, "arg arrs diff length");
        require(_tokenId.length == _maxRentDuration.length, "arg arrs diff length");
        require(_maxRentDuration.length == _dailyRentPrice.length, "arg arrs diff length");
        require(_nftPrice.length == _paymentToken.length, "arg arrs diff length");
        for (uint256 i = 0; i < _nft.length; i++) {
            require(_maxRentDuration[i] > 0, "must be at least one day lend");
            require(_maxRentDuration[i] <= 1825, "must be less than five years");
            _nft[i].safeTransferFrom(msg.sender, address(this), _tokenId[i]);
            bytes32 itemHash = keccak256(abi.encodePacked(address(_nft[i]), _tokenId[i], id));
            LendingRenting storage item = lendingRenting[itemHash];
            item.lending = Lending({
                lenderAddress: msg.sender,
                maxRentDuration: _maxRentDuration[i],
                dailyRentPrice: bytes4(_dailyRentPrice[i]),
                nftPrice: bytes4(_nftPrice[i]),
                paymentToken: _paymentToken[i]
            });
            emit Lent(
                address(_nft[i]),
                _tokenId[i],
                id,
                msg.sender,
                _maxRentDuration[i],
                _dailyRentPrice[i],
                _nftPrice[i],
                _paymentToken[i]
            );
            // changing from non-zero to something else costs 5000 gas
            // however, changing from zero to something else costs 20k gas
            id++;
        }
    }

    function rent(
        IERC721[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id,
        uint16[] memory _rentDuration
    ) external payable nonReentrant {
        require(_nft.length == _tokenId.length, "1 arg arrs diff length");
        require(_tokenId.length == _id.length, "2 arg arrs diff length");
        require(_id.length == _rentDuration.length, "3 arg arrs diff length");
        RentCutie memory rc;
        rc.ethPmtRequired = 0;
        rc.nftLen = _nft.length - 1;
        for (uint256 i = 0; i < _nft.length; i++) {
            rc.tokenId = _tokenId[i];
            rc.id = _id[i];
            rc.nft = _nft[i];
            LendingRenting storage item =
                lendingRenting[keccak256(abi.encodePacked(address(rc.nft), rc.tokenId, rc.id))];
            require(item.renting.renterAddress == address(0), "1 already rented");
            require(item.renting.rentDuration == 0, "2 already rented");
            require(item.renting.rentedAt == 0, "3 already rented");
            require(msg.sender != item.lending.lenderAddress, "cant rent own nft");
            rc.rentDuration = _rentDuration[i];
            require(rc.rentDuration > 0, "should rent for at least a day");
            require(rc.rentDuration <= item.lending.maxRentDuration, "max rent duration exceeded");
            rc.decimals = 18;
            rc.paymentTokenIndex = uint8(item.lending.paymentToken);
            rc.paymentToken = resolver.getPaymentToken(rc.paymentTokenIndex);
            rc.isERC20 = rc.paymentTokenIndex > 1;
            if (rc.isERC20) {
                // 1 marks ETH
                rc.decimals = ERC20(rc.paymentToken).decimals();
            }
            rc.scale = 10**rc.decimals;
            rc.rentPrice = rc.rentDuration * _unpackPrice(item.lending.dailyRentPrice, rc.scale); // max is 1825 * 65535. Nowhere near the overflow
            rc.nftPrice = _unpackPrice(item.lending.nftPrice, rc.scale);
            // collateral may be set to zero, if the lender wishes so
            // but not the rent price
            require(rc.rentPrice > 0, "rent price is zero");
            rc.upfrontPayment = rc.rentPrice + rc.nftPrice;
            if (rc.isERC20) {
                ERC20(rc.paymentToken).safeTransferFrom(msg.sender, address(this), rc.upfrontPayment);
            } else {
                rc.ethPmtRequired += rc.upfrontPayment;
                // require(msg.value == upfrontPayment, "insufficient amount");
            }
            if (i == rc.nftLen) {
                require(msg.value == rc.ethPmtRequired, "insufficient amount");
            }
            item.renting.renterAddress = msg.sender;
            item.renting.rentDuration = rc.rentDuration;
            item.renting.rentedAt = uint32(block.timestamp);
            rc.nft.transferFrom(address(this), msg.sender, rc.tokenId);
            emit Rented(address(rc.nft), rc.tokenId, rc.id, msg.sender, rc.rentDuration, uint32(block.timestamp));
        }
    }

    /**
     * We have half fee here because the fee is paid in half
     * by the renter and the lender
     */
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
            // 1 marks ETH
            decimals = ERC20(paymentToken).decimals();
        }
        uint256 scale = 10**decimals;
        uint256 nftPrice = _unpackPrice(_lendingRenting.lending.nftPrice, scale);
        uint256 rentPrice = _unpackPrice(_lendingRenting.lending.dailyRentPrice, scale);
        // need to convert daily price to price per second
        // daily price = x, then price per second is x / 86400 = y
        // we now multiply y by the number of seconds that the NFT was
        // rented out for.
        // final formula is (_secondsSinceRentStart *  x) / 86400
        // the fee is NOT taken from the collateral paid by the renter
        uint256 renterPayment = rentPrice * _lendingRenting.renting.rentDuration;
        // if a * b < c then lender will get 0.
        // rentPrice can't be zero, if the token is 18 decimals, below
        // calc is guaranteed to return a meaningful result
        uint256 sendLenderAmt = (_secondsSinceRentStart * rentPrice) / 86400;
        // this will block the return and so lender will be able to claim the collateral
        // equality happens when the renter returns at the very last second. This is
        // extremely unlikely to happen
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
        IERC721[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id
    ) public nonReentrant {
        for (uint256 i = 0; i < _nft.length; i++) {
            LendingRenting storage item =
                lendingRenting[keccak256(abi.encodePacked(address(_nft[i]), _tokenId[i], _id[i]))];
            require(item.renting.renterAddress == msg.sender, "not renter");
            uint256 secondsSinceRentStart = _ensureIsNotPastReturnDate(item.renting, block.timestamp);
            _nft[i].safeTransferFrom(msg.sender, address(this), _tokenId[i]);
            _distributePayments(item, secondsSinceRentStart);
            emit Returned(address(_nft[i]), _tokenId[i], _id[i], msg.sender, uint32(block.timestamp));
            delete item.renting;
        }
    }

    function claimCollateral(
        IERC721[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id
    ) public nonReentrant {
        for (uint256 i = 0; i < _nft.length; i++) {
            LendingRenting storage item =
                lendingRenting[keccak256(abi.encodePacked(address(_nft[i]), _tokenId[i], _id[i]))];
            _ensureIsPastReturnDate(item.renting, block.timestamp);
            _ensureIsNotNull(item.lending);
            _ensureIsNotNull(item.renting);
            _distributeClaimPayment(item);
            delete item.lending;
            delete item.renting;
            emit CollateralClaimed(address(_nft[i]), _tokenId[i], _id[i], uint32(block.timestamp));
        }
    }

    function stopLending(
        IERC721[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id
    ) public {
        for (uint256 i = 0; i < _nft.length; i++) {
            LendingRenting storage item = lendingRenting[keccak256(abi.encodePacked(_nft[i], _tokenId[i], _id[i]))];
            _ensureIsNull(item.renting);
            require(item.lending.lenderAddress == msg.sender, "only lender allowed");
            _nft[i].safeTransferFrom(address(this), msg.sender, _tokenId[i]);
            delete item.lending;
            emit LendingStopped(address(_nft[i]), _tokenId[i], _id[i], uint32(block.timestamp));
        }
    }

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

    function _ensureIsNotNull(Lending memory _lending) private pure {
        require(_lending.lenderAddress != address(0), "lender is zero address");
        require(_lending.maxRentDuration != 0, "max rent duration is zero");
        require(_lending.dailyRentPrice != 0, "daily rent price is zero");
        require(_lending.nftPrice != 0, "nft price is zero");
        require(_lending.paymentToken != Resolver.PaymentToken.SENTINEL, "payment token is sentinel");
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

    function _ensureIsPastReturnDate(Renting memory _renting, uint256 _now) private pure {
        require(_now - _renting.rentedAt > _renting.rentDuration * 86400, "duration not exceeded");
    }

    function _ensureIsNotPastReturnDate(Renting memory _renting, uint256 _now)
        private
        pure
        returns (uint256 secondsSinceRentStart)
    {
        secondsSinceRentStart = _now - _renting.rentedAt;
        require(secondsSinceRentStart <= _renting.rentDuration * 86400, "duration exceeded");
    }

    function setRentFee(uint256 _rentFee) external onlyOwner {
        require(_rentFee < 10000, "1 cannot be taking 100 pct fee");
        rentFee = _rentFee;
    }

    function setBeneficiary(address payable _newBeneficiary) external onlyOwner {
        beneficiary = _newBeneficiary;
    }
}
