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

contract RentNft is ReentrancyGuard, Ownable, ERC721Holder {
    using SafeERC20 for ERC20;
    // 256 bits -> 32 bytes
    // address - 20 byte value -> 160 bits
    uint256 private id = 1;
    // settable by owner and chargeable on the final rent price
    uint256 public rentFee = 0;
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
        for (uint256 i = 0; i < _nft.length; i++) {
            uint256 __tokenId = _tokenId[i];
            uint256 __id = _id[i];
            IERC721 __nft = _nft[i];
            LendingRenting storage item = lendingRenting[keccak256(abi.encodePacked(address(__nft), __tokenId, __id))];
            require(item.renting.renterAddress == address(0), "1 already rented");
            require(item.renting.rentDuration == 0, "2 already rented");
            require(item.renting.rentedAt == 0, "3 already rented");
            require(msg.sender != item.lending.lenderAddress, "cant rent own nft");
            uint16 _rentDur = _rentDuration[i];
            require(_rentDur > 0, "should rent for at least a day");
            require(_rentDur <= item.lending.maxRentDuration, "max rent duration exceeded");
            uint256 decimals = 18;
            uint8 paymentTokenIx = uint8(item.lending.paymentToken);
            address paymentToken = resolver.getPaymentToken(paymentTokenIx);
            bool isERC20 = paymentTokenIx > 1;
            if (isERC20) {
                // 1 marks ETH
                decimals = ERC20(paymentToken).decimals();
            }
            uint256 rentPrice = _rentDur * _unpackPrice(item.lending.dailyRentPrice, decimals); // max is 1825 * 65535. Nowhere near the overflow
            uint256 nftPrice = _unpackPrice(item.lending.nftPrice, decimals);
            uint256 upfrontPayment = rentPrice + nftPrice;
            if (isERC20) {
                ERC20(paymentToken).safeTransferFrom(msg.sender, address(this), upfrontPayment);
            } else {
                require(msg.value == upfrontPayment, "insufficient amount");
            }
            item.renting.renterAddress = msg.sender;
            item.renting.rentDuration = _rentDur;
            item.renting.rentedAt = uint32(block.timestamp);
            __nft.transferFrom(address(this), msg.sender, __tokenId);
            emit Rented(address(__nft), __tokenId, __id, msg.sender, _rentDur, uint32(block.timestamp));
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
    function _distributePayments(
        IERC721 _nft,
        uint256 _tokenId,
        uint256 _id,
        uint256 _secondsSinceRentStart
    ) private {
        LendingRenting storage item = lendingRenting[keccak256(abi.encodePacked(address(_nft), _tokenId, _id))];
        uint256 decimals = 18;
        uint8 paymentTokenIx = uint8(item.lending.paymentToken);
        address paymentToken = resolver.getPaymentToken(paymentTokenIx);
        bool isERC20 = paymentTokenIx > 1;
        if (isERC20) {
            // 1 marks ETH
            decimals = ERC20(paymentToken).decimals();
        }
        uint256 nftPrice = _unpackPrice(item.lending.nftPrice, decimals);
        uint256 rentPrice = _unpackPrice(item.lending.dailyRentPrice, decimals);
        // compute money owed from the rentedAt period until block.timestamp
        // max is the uint16 for maxRentDuration
        // the largest value here is max(uint16) * 86400
        // i.e. 65535 * 86400 -> 5662224000, 5 billion
        uint256 renterMaxSeconds = item.renting.rentDuration * 86400;
        require(renterMaxSeconds >= _secondsSinceRentStart, "attempt to return after deadline");
        // need to convert daily price to price per second
        // daily price = x, then price per second is x / 86400 = y
        // we now multiply y by the number of seconds that the NFT was
        // rented out for.
        // final formula is (_secondsSinceRentStart *  x) / 86400
        uint256 renterPayment = rentPrice * item.renting.rentDuration;
        // if a * b < c then lender will get 0.
        // rentPrice can't be zero, if the token is 18 decimals, below
        // calc is guaranteed to return a meaningful result
        uint256 sendLenderAmt = (_secondsSinceRentStart * rentPrice) / 86400;
        // this will block the return and so lender will be able to claim the collateral
        // equality happens when the renter returns at the very last second. This is
        // extremely unlikely to happen
        require(renterPayment >= sendLenderAmt, "lender receiving more than renter pmt");
        // unused
        uint256 sendRenterAmt = renterPayment - sendLenderAmt;
        require(renterPayment > sendRenterAmt, "underflow issues prevention");
        uint256 takenFee = _takeFee(sendLenderAmt, item.lending.paymentToken);
        sendRenterAmt += nftPrice;
        if (isERC20) {
            ERC20(paymentToken).safeTransfer(item.lending.lenderAddress, sendLenderAmt - takenFee);
            ERC20(paymentToken).safeTransfer(item.renting.renterAddress, sendRenterAmt);
        } else {
            require(paymentTokenIx == 1, "sentinels dont pay");
            item.lending.lenderAddress.transfer(sendLenderAmt - takenFee);
            item.renting.renterAddress.transfer(sendRenterAmt);
        }
    }

    function _distributeClaimPayment(
        IERC721 _nft,
        uint256 _tokenId,
        uint256 _id
    ) private {
        LendingRenting storage item = lendingRenting[keccak256(abi.encodePacked(address(_nft), _tokenId, _id))];
        uint256 decimals = 18;
        uint8 paymentTokenIx = uint8(item.lending.paymentToken);
        address paymentToken = resolver.getPaymentToken(paymentTokenIx);
        bool isERC20 = paymentTokenIx > 1;
        if (isERC20) {
            // 1 marks ETH
            decimals = ERC20(paymentToken).decimals();
        }
        uint256 nftPrice = _unpackPrice(item.lending.nftPrice, decimals);
        uint256 rentPrice = _unpackPrice(item.lending.dailyRentPrice, decimals);
        uint256 maxRentPayment = rentPrice * item.renting.rentDuration;
        uint256 takenFee = _takeFee(maxRentPayment, Resolver.PaymentToken(paymentTokenIx));
        uint256 finalAmt = maxRentPayment + nftPrice;
        if (isERC20) {
            ERC20(paymentToken).safeTransfer(item.lending.lenderAddress, finalAmt - takenFee);
        } else {
            item.lending.lenderAddress.transfer(finalAmt - takenFee);
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
            uint256 secondsSinceRentStart = block.timestamp - item.renting.rentedAt;
            uint16 durationInDays = uint16(secondsSinceRentStart / 86400);
            require(durationInDays <= item.renting.rentDuration, "duration exceeded");
            _nft[i].safeTransferFrom(msg.sender, address(this), _tokenId[i]);
            _distributePayments(_nft[i], _tokenId[i], _id[i], secondsSinceRentStart);
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
            _distributeClaimPayment(_nft[i], _tokenId[i], _id[i]);
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
            require(item.renting.rentDuration == 0, "nft rented currently");
            require(item.lending.lenderAddress == msg.sender, "not lender");
            IERC721(_nft[i]).safeTransferFrom(address(this), msg.sender, _tokenId[i]);
            delete item.lending;
            emit LendingStopped(address(_nft[i]), _tokenId[i], _id[i], uint32(block.timestamp));
        }
    }

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

    function setRentFee(uint256 _rentFee) external onlyOwner {
        require(_rentFee < 10000, "1 cannot be taking 100 pct fee");
        rentFee = _rentFee;
    }

    function setBeneficiary(address payable _newBeneficiary) external onlyOwner {
        beneficiary = _newBeneficiary;
    }
}
