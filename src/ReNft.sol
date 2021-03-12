// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/IResolver.sol";
import "./interfaces/IReNft.sol";

//-|----------------------------------------------------------------------------------------------------|-
// |````````````...-/://::-:---::-:.-........`````````````````````````````````````````````````````````.`|
// |..............-ooosyss+++//o+////::-...--...........................................................|
// |..............:s+syoos+/+/oo+o/:/:---..-............................................................|
// |............--/sohysss+/+oso+o+///:--.---.......................................-...................|
// |...........---+syhsyso+++soo/o/:+/:--.---..........................................-................|
// |...........---oyhhysoo++osso+++:/:--..--............................................---.............|
// |`.`........--:syhhyss+o++ssoo+o/::---.--..............................:-.......................```..|
// |````.......--/yhhhyys+oooyyos++::----...............................-:::.......................`````|
// |```........--+hdhhyso+ssssyoy+/:::----............................-::::::..................`````````|
// |``.`.......-:ohddysssssyyyyss+o/:::----..........................::::::-:-..................````````|
// |`..........-:ohdhyssyyyyhysyo++//:::---........................-/:::::::::....................``````|
// |...........-/sdddhysyyhydhsss++//:::----.....................-://:::/::::::..................```````|
// |...........-/yhddhhhhyhdmhssso+++/:::---...................--:/:::///:::://-.............```````````|
// |.`.........-/hdddhhddyhmmdsyyso++//:::---.................:+///:/++//:::/:::..........``````````````|
// |.`.........-+hdmhydmmhdmNdhysoo++///:::----.............-+++/////+++//////::-........```````````````|
// |``.........:ohdmyydNmhhdNdddyso+++///:::----..........-://++++++++++///////::---....````````````````|
// |..........-:ohdmyhmNmhshNmmhyyo+++////::---..........:+///++++++++++++////////---..``..``````..`````|
// |..........-:sddmhhmNmhydNmmhys+///+/::-:--.........-/+//++o+++++++o+++++//////:---.......`...```````|
// |..........-:sdddhhNmmhyymmdhysso+///::----........:+o//++++++++o+++++++++//////:--...........`````..|
// |..........-:smddhdmmmdysddhhsss++///::---.......-/oo/+++++o++ooo+o+++++++++////:-............````...|
// |.........--:sdddhdmmmhsshdhysso++//:::--......-/++o+/+++++++oooooo++++++++++//+/:.......`...````....|
// |..........-:sdddhdmmmhssyhyyso+++//::---.....://ooo+++++++++ossoo++++++++++++/++/:.-........``......|
// |..........-:sdddhmmmmhsssyyyso++o+/::------:/ooso+o++oo++oosssooo+++++++::+++/++//-----.-...........|
// |..........-:yhhdhmmddhsyssssoo+oo+/:::::::/+osss+++++oo+ossoooooo+++++++//++++++/+/------...........|
// |..........-:ydhhhmmdmhsysyssso+++/++/::/+++osyssossossssssssssss+++++++++++++++++++:------......--..|
// |..........-:sdhhdmmmmyyyyysssooo+++++/oysoshhyyssyyhyyyyyysssss++++++++++oso+oo++oo+:::---..-..--.-.|
// |.........--:sdhddmmmdyssyysoso+/+////syoosyyys+osssossosoo+oooo+/+++++++osssoosoosooo/:---------....|
// |......-----:smhddmmmhsssyssoso+///:::////++++++++++++++++/++o++//++++o++ooooosyysssoo/---.-----.....|
// |.....----::/smhdmmmdyssoyssssoo+///::--:////+++++++++++++/++o++/++//++++oossyhyhysssoo:-.----.......|
// |--------:::/smhdmdmddooossyssoo++//:::--://++++++++/+/+++++++o+++/++++++++sssyyyyysso+/-.--------.--|
// |:::::::::::/smddddmddyooosysooo+///:::----/++++++++/++++//+++o++++++++++ossysyyyyyysoso:---::::::---|
// |:///////:://smddddmmdhsyyssso++++///:+/---::/+//+++++++++/++oo++oo++++oosssyyyhddhssoso+:-:---------|
// |--:---:---::oddddhdddysyysyso//oo+++//o+/-..-:///+++++++o+++o++++++oooossyhhhhhdhhyyso/:::-:::::::::|
// |-----------:+ddddhhhdyssssso+ooossso++/oo+:----:/+/++++++++oo++++++oosssydmddddhysoooo//:///://:::::|
// |.......-----/hdddhhyhssyssoooosyhdddyso+ssoo+:---//+o+++o++oo+ooo+++osssyhdmdho+/::/++/:/++/:::-----|
// |-``.``.-::::/yhdddhyyoo+oossssyhmNNmdyo+/ssyyo/-.-:osso++o+o++oo+/+osyyssso+/::--::://::/+o/::---...|
// |-``````.---..-+hdhhys:::::oooosyhddhso+/::ooo+o/:..-/++++ooo////++oosso/:--::::/++//::::/++//:----..|
// |..`..``--.....-odhhyo::::-/++++++oo++//:---++++++/-..://++o+////+///:-.-/////+oo+:---:/+osy+:---::-.|
// |.......-.``.-..odhyys+:----////://:/::--...-/++++++/-..::/++///:-...--://+++++/:-..-:///+os+--...--.|
// |-............-+hhhs+:----.-:::--/:---...---../+++o+++:-..:/:-....::://////+/:-...--::://:/o:....--..|
// |............-/hhy+::-..-..:::.-:::......-:-:--++ooo++//:....--:://////////:-.....--..---:+:....-.---|
// |..........:++ohh+--..---..-::.-:-..`..``.--:++-+ooo+//////::////////////:-:-..........-/+-......---.|
// |.........-/++sho::...-:-..-::-:-.``````.-..:::--/+o++/+oso///////////::-.......`.....-/:......---.``|
// |........--::/+s/:::::--...--::--..`````.:-.-:--../+ooooooso+///+++/-.....``````....-::-......::-````|
// |..........--:+yo/----.....--:::-.........-..-:----/+oossosoo++++:-...``````.......::-......-:-.`````|
// |............:os++:-/---..`..-::--..---......-://::/:/ossoo+/:---.....`````.--.`.``......-::-..``````|
// |...........-:oo++:/s+o/.....--:::-----.-..-.-:--..::://+/:-...............---..`````..----.``.``````|
// |......------/ooooo:///-....----:::/::::/:------.-/+++/://:-..`........`...:....-`.``..--.```.-...```|
// |.----------:+ossss+---..:-.--::/+oo+oo++//----::::::::-:/:://---/---..---.:--.--.```.--.````...-....|
// |..--------::/oosssoo:--:/-.--/++sssysso+////:/::::::---:::://:-::.-...----/--::-.`..::----...----...|
// |..-------::/+oooooo+:--/+-.--oooossoooo++++/:::::::---::--------...-------:-::/-....-.....---------.|
// |..-----::::/++ooooo+:--++-.--oooooooooooo++//:::::::--------...-....----:-::::----...-....----......|
// |...------:::/+oo+++/-.-//-..:+++++++ooooo+//////:::::::------.---.----:-:-------:::-:-............``|
// |......-----::/+++//:--:/:--.://///////++++///////////:::::::--:::-------.------//::--.............``|
// |.......----::/++///-.-:/:-..:////////:////////////+///////:::::-::----.....------....``.``.....`````|
// |.........----:+o+//-..:::.../////////::::/::::/:://///////:::------..-...--------.-.````````````````|
// |..........-/+++/:::-..::-...:///:::::::::::::::://///////::-------.........-...----.````````````````|
// |..........-/++/::-:------..-----::::::::::::::::::::://///::::-----..........----:---```````````````|
// |..........-:++:--.....``........`.......--::------:::::::::--------..........--.----.```.```````````|
// |..........-//-```````.```.`````..`````````----------:::::::--------......................```````....|
// |`.........-..``````````````````````````````.------------------------................................|
// |........`...````````````````````````````````......------:---------.................-------..--......|
// |````...`````````````````````````````````````...........------:-::::---..-..........-------..--......|
// |`````.```````````````````````````````````````.--.........--::::--::::--......----..-----..-........-|
// |```````````````````````````````````````````````-..``````......................---...--.......--.....|
//-|----------------------------------------------------------------------------------------------------|-

// - TODO: erc1155 amounts not supported in this version
// adding the amounts, would imply that lending struct would
// become two single storage slots, since it only has 4 bits
// of free space.
abstract contract ReNft is IReNft, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IResolver private resolver;
    address private admin;
    address payable private beneficiary;
    uint256 private lendingId = 1;

    uint256 public rentFee = 500;

    // single storage slot: address - 160 bits, 176, 208, 240, 248
    struct Lending {
        address payable lenderAddress;
        uint16 maxRentDuration;
        bytes4 dailyRentPrice;
        bytes4 nftPrice;
        IResolver.PaymentToken paymentToken;
    }

    // single storage slot: 160 bits, 176, 198
    struct Renting {
        address payable renterAddress;
        uint16 rentDuration;
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
        resolver = IResolver(_resolver);
        beneficiary = _beneficiary;
        admin = _admin;
    }

    // Lightly brainy section ahead
    // ----
    // So here is a random joke from the Internet before you venture out
    // into split or double-split or gazillion-times-split screen to read
    // all the contracts and piece it all together (because I am bad
    // at remembering, or coming up with jokes)
    // Here comes the joke:
    // You don't need a parachute to go skydiving.
    // You need a parachute to go skydiving twice.
    // ----

    function lend(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint16[] memory _maxRentDuration,
        bytes4[] memory _dailyRentPrice,
        bytes4[] memory _nftPrice,
        IResolver.PaymentToken[] memory _paymentToken
    ) external override nonReentrant {
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
    ) external payable override nonReentrant {
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
                rc.decimals = IERC20(rc.paymentToken).decimals();
            }

            rc.scale = 10**rc.decimals;
            // max is 1825 * 65535. Nowhere near the overflow
            rc.rentPrice = rc.rentDuration * _unpackPrice(item.lending.dailyRentPrice, rc.scale);
            rc.nftPrice = _unpackPrice(item.lending.nftPrice, rc.scale);

            require(rc.rentPrice > 0, "rent price is zero");

            rc.upfrontPayment = rc.rentPrice + rc.nftPrice;

            if (rc.isERC20) {
                IERC20(rc.paymentToken).safeTransferFrom(msg.sender, address(this), rc.upfrontPayment);
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

    function _takeFee(uint256 _rent, IResolver.PaymentToken _paymentToken) private returns (uint256 fee) {
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

    /**
     * @dev send rent amounts to lender, send unused
     * rent amonuts to renter. Send the collateral
     * back to renter. Fee is only ever charged on
     * used rent payments. Initially, it will be set at zero.
     * Gets called only when the NFT is returned.
     * _takeFee is here and in distributeClaimPayments.
     *
     * @param _lendingRenting when you return the NFT,
     * you will have provided the lendingId, with it,
     * as well as, nft address and token id, you can
     * uniquely identify an NFT on reNFT.
     * @param _secondsSinceRentStart seconds since rent
     * start
     */
    function _distributePayments(LendingRenting storage _lendingRenting, uint256 _secondsSinceRentStart) private {
        uint256 decimals = 18;
        uint8 paymentTokenIx = uint8(_lendingRenting.lending.paymentToken);
        address paymentToken = resolver.getPaymentToken(paymentTokenIx);
        bool isERC20 = paymentTokenIx > 1;

        if (isERC20) {
            decimals = IERC20(paymentToken).decimals();
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
            IERC20(paymentToken).safeTransfer(_lendingRenting.lending.lenderAddress, sendLenderAmt - takenFee);
            IERC20(paymentToken).safeTransfer(_lendingRenting.renting.renterAddress, sendRenterAmt);
        } else {
            require(paymentTokenIx == 1, "sentinels dont pay");

            _lendingRenting.lending.lenderAddress.transfer(sendLenderAmt - takenFee);
            _lendingRenting.renting.renterAddress.transfer(sendRenterAmt);
        }
    }

    function _distributeClaimPayment(LendingRenting memory _lendingRenting) private {
        uint256 decimals = 18;
        uint8 paymentTokenIx = uint8(_lendingRenting.lending.paymentToken);
        IERC20 paymentToken = IERC20(resolver.getPaymentToken(paymentTokenIx));

        bool isERC20 = paymentTokenIx > 1;

        if (isERC20) {
            decimals = paymentToken.decimals();
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

    function returnIt(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id
    ) public override nonReentrant {
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
    ) public override nonReentrant {
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
    ) public override {
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

    // We can handle erc1155s
    // ----
    // ┈╱╱▏┈┈╱╱╱╱▏╱╱▏┈┈┈
    // ┈▇╱▏┈┈▇▇▇╱▏▇╱▏┈┈┈
    // ┈▇╱▏▁┈▇╱▇╱▏▇╱▏▁┈┈
    // ┈▇╱╱╱▏▇╱▇╱▏▇╱╱╱▏┈
    // ┈▇▇▇╱┈▇▇▇╱┈▇▇▇╱┈┈
    // and jokes, too
    // ----

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
    // ----
    //
    // ___$$$___$$$____
    // __$$$$$_$$$$$___
    // __$$$$$$$$$$$___
    // ____$$$$$$$_____
    // ______$$$_______
    // _______$
    // _____¸.•´¸.•*¸.•*´¨`*•.♥
    // _____*.¸¸.•*¨`
    //
    // ----

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
    // ----
    //   __
    //  /  |           /
    // (___| ___  ___ (___  ___  ___  ___
    // |    |   )|   )|    |___)|    |
    // |    |    |__/ |__  |__  |__  |__
    // ----

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
    // ----
    //   __
    //  /  |    |      /                     /
    // (___| ___| _ _    ___       ___  ___ (
    // |   )|   )| | )| |   )     |   )|   )| \   )
    // |  / |__/ |  / | |  /      |__/ |  / |  \_/
    // ----                                          /

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
