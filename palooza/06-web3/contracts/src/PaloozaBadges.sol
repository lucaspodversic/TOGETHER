// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title PaloozaBadges
/// @notice EN: Soulbound (non-transferable) ERC-1155-style achievement badges. One badge id per
///         achievement; each wallet holds at most 1 of each. No transfers, no sales, no value:
///         badges are a public, verifiable mirror of in-game achievements only.
///         ES: Insignias de logros soulbound (intransferibles) estilo ERC-1155. Un id por logro; cada
///         wallet tiene como máximo 1 de cada uno. Sin transferencias, sin ventas, sin valor: son solo
///         un espejo público y verificable de los logros del juego.
/// @dev EN: Minimal self-contained implementation (no external deps) so it is easy to audit.
///      Transfer functions always revert (EIP-5633-like soulbound signal via `locked`).
///      ES: Implementación mínima autocontenida (sin dependencias) para que sea fácil de auditar.
///      Las funciones de transferencia siempre revierten (señal soulbound tipo EIP-5633 vía `locked`).
contract PaloozaBadges {
    // EN: Roles. / ES: Roles.
    address public owner;
    mapping(address => bool) public isMinter;
    bool public paused;

    // EN: balances[id][holder] ∈ {0,1}. / ES: balances[id][titular] ∈ {0,1}.
    mapping(uint256 => mapping(address => uint256)) private _balances;
    // EN: Registered badge ids (only these can be minted). / ES: Ids registrados (solo estos se mintean).
    mapping(uint256 => bool) public badgeExists;
    mapping(uint256 => string) private _uris;

    // EN: ERC-1155 standard events. / ES: Eventos estándar ERC-1155.
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event URI(string value, uint256 indexed id);
    // EN: Admin events for audit trails. / ES: Eventos de admin para auditoría.
    event MinterSet(address indexed minter, bool allowed);
    event BadgeRegistered(uint256 indexed id, string uri);
    event Paused(bool paused);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotMinter();
    error IsPaused();
    error UnknownBadge(uint256 id);
    error AlreadyHolds(address holder, uint256 id);
    error Soulbound();
    error ZeroAddress();
    error NotHolder();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyMinter() {
        if (!isMinter[msg.sender]) revert NotMinter();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    // ───────────── EN: Admin / ES: Administración ─────────────

    /// @notice EN: Allow/deny a minter (the backend relayer). / ES: Permite/niega un minter (el relayer del backend).
    function setMinter(address minter, bool allowed) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        isMinter[minter] = allowed;
        emit MinterSet(minter, allowed);
    }

    /// @notice EN: Register a badge id with its metadata URI. / ES: Registra un id con su URI de metadatos.
    function registerBadge(uint256 id, string calldata uri_) external onlyOwner {
        badgeExists[id] = true;
        _uris[id] = uri_;
        emit BadgeRegistered(id, uri_);
        emit URI(uri_, id);
    }

    /// @notice EN: Emergency stop for minting. / ES: Parada de emergencia del minteo.
    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit Paused(p);
    }

    /// @notice EN: Two-step-free ownership transfer (owner should be a multisig). / ES: Transferencia de dueño (debería ser multisig).
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ───────────── EN: Mint / burn — ES: Minteo / quema ─────────────

    /// @notice EN: Mint one badge to a player (max 1 per id). / ES: Mintea una insignia a un jugador (máx 1 por id).
    function mint(address to, uint256 id) external onlyMinter {
        if (paused) revert IsPaused();
        if (to == address(0)) revert ZeroAddress();
        if (!badgeExists[id]) revert UnknownBadge(id);
        if (_balances[id][to] != 0) revert AlreadyHolds(to, id);
        _balances[id][to] = 1;
        emit TransferSingle(msg.sender, address(0), to, id, 1);
    }

    /// @notice EN: Holder may burn their own badge (right to leave). / ES: El titular puede quemar su insignia (derecho a irse).
    function burn(uint256 id) external {
        if (_balances[id][msg.sender] == 0) revert NotHolder();
        _balances[id][msg.sender] = 0;
        emit TransferSingle(msg.sender, msg.sender, address(0), id, 1);
    }

    // ───────────── EN: Views / ES: Lecturas ─────────────

    function balanceOf(address account, uint256 id) external view returns (uint256) {
        return _balances[id][account];
    }

    function uri(uint256 id) external view returns (string memory) {
        return _uris[id];
    }

    /// @notice EN: Always locked (soulbound). / ES: Siempre bloqueada (soulbound).
    function locked(uint256 id) external view returns (bool) {
        if (!badgeExists[id]) revert UnknownBadge(id);
        return true;
    }

    /// @notice EN: ERC-165: ERC-1155 (0xd9b67a26), metadata URI (0x0e89341c), ERC-165. / ES: ídem.
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0xd9b67a26 || interfaceId == 0x0e89341c;
    }

    // ───────────── EN: Transfers disabled / ES: Transferencias deshabilitadas ─────────────

    function safeTransferFrom(address, address, uint256, uint256, bytes calldata) external pure {
        revert Soulbound();
    }

    function safeBatchTransferFrom(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }
}
