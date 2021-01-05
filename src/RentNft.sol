// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.8.0;
import "./Resolver.sol";
// import "./ChiGasSaver.sol";

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract RentNft is ReentrancyGuard, Ownable, ERC721Holder {
    using SafeERC20 for IERC20;

    // 256 bits -> 32 bytes
    // address - 20 byte value -> 160 bits
    uint256 private id = 1;
    // settable by owner and chargeable on the final rent price
    uint256 public rentFee = 0;
    // settable by owner and chargeable on collateral amounts
    // for gas efficiency, both of the above are not sent immediately
    // only owner can withdraw the accrued amounts
    uint256 public nftPriceFee = 0;
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
        PaymentToken paymentToken
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
        address lenderAddress;
        // 176 bits
        uint16 maxRentDuration;
        // 208 bits
        uint32 dailyRentPrice;
        // 240 bits
        uint32 nftPrice;
        // 248 bits
        PaymentToken paymentToken;
    }

    struct Renting {
        // 160 bits
        address renterAddress;
        // 176 bits
        uint16 rentDuration;
        // 198 bits
        uint32 rentedAt;
    }

    struct LendingRenting {
        Lending lending;
        Renting renting;
    }

    enum PaymentToken {
        DAI, // 0
        USDC, // 1
        USDT, // 2
        TUSD, // 3
        NAZ // 4
    }

    // 32 bytes key to 64 bytes struct
    mapping(bytes32 => LendingRenting) private lendingRenting;

    constructor(Resolver _resolver, address payable _beneficiary) {
        resolver = _resolver;
        beneficiary = _beneficiary;
    }

    function lend(
        IERC721[] calldata _nft,
        uint256[] calldata _tokenId,
        uint16[] calldata _maxRentDuration,
        uint32[] calldata _dailyRentPrice,
        uint32[] calldata _nftPrice,
        PaymentToken[] calldata _paymentToken,
        address payable _gasSponsor
    ) public nonReentrant {
        for (uint256 i = 0; i < _nft.length; i++) {
            require(_maxRentDuration[i] > 0, "at least one day");
            uint256 tokenId = _tokenId[i];
            IERC721 nft = _nft[i];
            nft.safeTransferFrom(msg.sender, address(this), tokenId);
            /// @dev to avoid stack to deep. Access and assign, then reuse.
            uint16 maxRentDuration = _maxRentDuration[i];
            uint32 dailyRentPrice = _dailyRentPrice[i];
            uint32 nftPrice = _nftPrice[i];
            PaymentToken paymentToken = _paymentToken[i];
            address nftAddress = address(nft);
            bytes32 itemHash = keccak256(abi.encodePacked(nftAddress, tokenId, id));
            LendingRenting storage item = lendingRenting[itemHash];
            item.lending = Lending({
                lenderAddress: msg.sender,
                maxRentDuration: maxRentDuration,
                dailyRentPrice: dailyRentPrice,
                nftPrice: nftPrice,
                paymentToken: paymentToken
            });
            emit Lent(nftAddress, tokenId, id, msg.sender, maxRentDuration, dailyRentPrice, nftPrice, paymentToken);
            // changing from non-zero to something else costs 5000 gas
            // however, changing from zero to something else costs 20k gas
            id++;
        }
    }

    function rent(
        IERC721[] calldata _nft,
        uint256[] calldata _tokenId,
        uint256[] calldata _id,
        uint16[] calldata _rentDuration,
        address payable _gasSponsor
    ) public nonReentrant {
        for (uint256 i = 0; i < _nft.length; i++) {
            LendingRenting storage item = lendingRenting[keccak256(
                abi.encodePacked(address(_nft[i]), _tokenId[i], _id[i])
            )];
            require(item.renting.rentDuration == 0, "already rented");
            require(msg.sender != item.lending.lenderAddress, "can't rent own nft");
            require(_rentDuration[i] <= item.lending.maxRentDuration, "max duration exceeded");
            uint256 rentPrice = _rentDuration[i] * _unpackPrice(bytes4(item.lending.dailyRentPrice));
            uint256 nftPrice = _unpackPrice(bytes4(item.lending.nftPrice));
            IERC20 paymentToken = resolver.getPaymentToken(uint8(item.lending.paymentToken));
            paymentToken.safeTransferFrom(msg.sender, address(this), rentPrice + nftPrice);
            item.renting.renterAddress = msg.sender;
            item.renting.rentDuration = _rentDuration[i];
            item.renting.rentedAt = uint32(block.timestamp);
            _nft[i].transferFrom(address(this), msg.sender, _tokenId[i]);
            emit Rented(address(_nft[i]), _tokenId[i], _id[i], msg.sender, _rentDuration[i], uint32(block.timestamp));
        }
    }

    function _takeFee(
        uint256 nftPrice,
        uint256 rent,
        IERC20 paymentToken
    ) internal returns (uint256 fee) {
        fee = nftPrice * nftPriceFee + rent * rentFee;
        paymentToken.safeTransfer(beneficiary, fee);
        fee /= 2;
    }

    function _distributePayments(
        IERC721 _nft,
        uint256 _tokenId,
        uint256 _id,
        uint256 _secondsSinceRentStart
    ) internal {
        LendingRenting storage item = lendingRenting[keccak256(abi.encodePacked(address(_nft), _tokenId, _id))];
        IERC20 paymentToken = resolver.getPaymentToken(uint8(item.lending.paymentToken));
        uint256 nftPrice = _unpackPrice(bytes4(item.lending.nftPrice));
        uint256 rentPrice = _unpackPrice(bytes4(item.lending.dailyRentPrice));
        // compute money owed from the rentedAt period until block.timestamp
        // max is the uint16 for maxRentDuration
        // the largest value here is max(uint16) * 86400
        // i.e. 65535 * 86400 -> 5662224000, 5 billion, way of uint256 overflow
        // seconds in a day
        uint256 renterMaxSeconds = item.renting.rentDuration * 86400;
        // daily rent price * daily rent duration = payment sent by the renter
        uint256 renterPayment = rentPrice * item.renting.rentDuration;
        require(renterMaxSeconds >= _secondsSinceRentStart, "attempt to return after deadline");
        uint256 sendLenderAmt = (_secondsSinceRentStart * renterPayment) / renterMaxSeconds;
        require(renterPayment >= sendLenderAmt, "maxRentPmt less than lender amount");
        uint256 sendRenterBackAmt = renterPayment - sendLenderAmt;
        require(sendLenderAmt + sendRenterBackAmt == renterPayment, "must equal to renter payment");
        uint256 halfFee = _takeFee(nftPrice, sendRenterBackAmt + sendLenderAmt, paymentToken);
        sendRenterBackAmt += nftPrice;
        require(sendRenterBackAmt >= sendRenterBackAmt - halfFee, "lol");
        paymentToken.safeTransfer(item.renting.renterAddress, sendRenterBackAmt - halfFee);
        require(sendLenderAmt >= sendLenderAmt - halfFee, "try again");
        paymentToken.safeTransfer(item.lending.lenderAddress, sendLenderAmt - halfFee);
    }

    function _distributeClaimPayment(
        IERC721 _nft,
        uint256 _tokenId,
        uint256 _id
    ) internal {
        LendingRenting storage item = lendingRenting[keccak256(abi.encodePacked(address(_nft), _tokenId, _id))];
        IERC20 paymentToken = resolver.getPaymentToken(uint8(item.lending.paymentToken));
        uint256 nftPrice = _unpackPrice(bytes4(item.lending.nftPrice));
        uint256 rentPrice = _unpackPrice(bytes4(item.lending.dailyRentPrice));
        // !: implicit type conversion from uint16 * uint32 to uint256
        uint256 maxRentPayment = rentPrice * item.renting.rentDuration;
        uint256 halfFee = _takeFee(nftPrice, maxRentPayment, paymentToken);
        halfFee += halfFee;
        uint256 finalAmt = maxRentPayment + nftPrice;
        require(finalAmt >= finalAmt - halfFee, "maybe next time");
        paymentToken.safeTransfer(item.lending.lenderAddress, finalAmt - halfFee);
    }

    function returnIt(
        IERC721[] calldata _nft,
        uint256[] calldata _tokenId,
        uint256[] calldata _id,
        address payable _gasSponsor
    ) public nonReentrant {
        for (uint256 i = 0; i < _nft.length; i++) {
            LendingRenting storage item = lendingRenting[keccak256(
                abi.encodePacked(address(_nft[i]), _tokenId[i], _id[i])
            )];
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
        IERC721[] calldata _nft,
        uint256[] calldata _tokenId,
        uint256[] calldata _id,
        address payable _gasSponsor
    ) public nonReentrant {
        for (uint256 i = 0; i < _nft.length; i++) {
            LendingRenting storage item = lendingRenting[keccak256(
                abi.encodePacked(address(_nft[i]), _tokenId[i], _id[i])
            )];
            _distributeClaimPayment(_nft[i], _tokenId[i], _id[i]);
            delete item.lending;
            delete item.renting;
            emit CollateralClaimed(address(_nft[i]), _tokenId[i], _id[i], uint32(block.timestamp));
        }
    }

    function stopLending(
        IERC721[] calldata _nft,
        uint256[] calldata _tokenId,
        uint256[] calldata _id,
        address _gasSponsor
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

    // We can't use uint256 for prices in the struct because
    // we must fit our struct in a single 32 byte chunk.
    // Since, no-one in their right mind will ever pay
    // $65k to rent an NFT for a single day, we have
    // set up this constraint on the prices that they
    // both are uint32. It is possible we may use
    // uint40 for collateral and uint24 for dailyRentPrice.
    // Anyhow, this constraint helps save us some extra 40k
    // in gas, that you dear lender and reader would pay.
    // So working under this constraints, the first 4 hexbytes
    // of the packed price contain the whole number information,
    // whereas the last 4 bytes represent the decimal portion
    // ! assumes 18 decimal places !
    // TODO: not the most efficient way of packing. Operating on
    // the bit level would allow us to give some extra precision
    // for the whole part. We are only using about 1/6th of the space
    // available for the decimal part. Our decimal part spans from 0 to 9999
    // but we have extra 65535 - 9999 numbers that could be used in the
    // whole part! Potentially, making the maximum 65535 + 65535 - 9999 =
    // 120000 + 11070 - 10000 + 1 = 120000 + 1071 = 121071
    // ----- Examples
    // 0x000f000f is 16.0016
    // 0x001f0001 is 17.0001
    // ----- Constraints
    // The maximum whole number is therefore 65535
    // The maximum decimal is 0.9999
    // Therefore the prices can be in [0, 65535.9999]
    function _unpackPrice(bytes4 _price) internal pure returns (uint256) {
        bytes2 who = bytes2(_price);
        bytes2 dec = bytes2(_price << 16);
        uint16 whole = uint16(who);
        uint16 decimal = uint16(dec);
        uint256 w = uint256(whole) * 1e18;
        if (decimal > 9999) {
            decimal = 9999;
        }
        bool find = true;
        uint16 divisor = 10;
        uint16 res = 1;
        while (find) {
            res = decimal / divisor;
            if (res == 0) {
                find = false;
            } else {
                divisor *= 10;
            }
        }
        uint256 d = decimal * (1e18 / uint256(divisor));
        uint256 price = d + w;
        return price;
    }

    function setRentFee(uint256 _rentFee) public onlyOwner {
        rentFee = _rentFee;
    }

    function setNftPriceFee(uint256 _nftPriceFee) public onlyOwner {
        nftPriceFee = _nftPriceFee;
    }

    function setBeneficiary(address payable _newBeneficiary) public onlyOwner {
        beneficiary = _newBeneficiary;
    }
}
