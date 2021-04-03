# SPEC

function lend(address[] memory _nft, uint256[] memory_tokenId, uint16[] memory _maxRentDuration, bytes4[] memory_dailyRentPrice, bytes4[] memory _nftPrice, IResolver.PaymentToken[] memory_paymentToken) external override nonReentrant {

function rent(address[] memory _nft, uint256[] memory_tokenId, uint256[] memory _id, uint16[] memory_rentDuration) external payable override nonReentrant

function _takeFee(uint256_rent, IResolver.PaymentToken _paymentToken) private returns (uint256 fee)

function _distributePayments(LendingRenting storage_lendingRenting, uint256 _secondsSinceRentStart) private

function _distributeClaimPayment(LendingRenting memory_lendingRenting) private

function returnIt(address[] memory _nft, uint256[] memory_tokenId, uint256[] memory _id) public override nonReentrant

function claimCollateral(address[] memory _nft, uint256[] memory_tokenId, uint256[] memory _id) public override nonReentrant

function stopLending(address[] memory _nft, uint256[] memory_tokenId, uint256[] memory _id) public override nonReentrant

function _safeTransfer(address_from, address _to, address_nft, uint256 _tokenId) private

(all the onReceives)

function _unpackPrice(bytes4_price, uint256 _scale) internal pure returns

function _decimals(address_tokenAddress) internal returns (uint256)

(all the ensures for validation)

function setRentFee(uint256 _rentFee) external

function setBeneficiary(address payable _newBeneficiary) external
