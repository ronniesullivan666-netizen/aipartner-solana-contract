use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("AgBSRTVFzdjV9ChfqEEJhCca2mn11Unw1vtZsP3NhqmN");

#[program]
pub mod aipartner_presale {
    use super::*;

    /// 初始化预售配置（绑定代币 Mint、收款账户、以及代币金库 Vault）
    pub fn initialize(ctx: Context<Initialize>, rate: u64) -> Result<()> {
        let presale_state = &mut ctx.accounts.presale_state;
        presale_state.admin = ctx.accounts.admin.key();
        presale_state.aipartner_mint = ctx.accounts.aipartner_mint.key();
        presale_state.vault_aipartner_account = ctx.accounts.vault_aipartner_account.key();
        presale_state.rate = rate;
        presale_state.total_sold = 0;
        Ok(())
    }

    /// 执行购买：扣除用户支付代币，并将金库中的 AIPartner 代币转给用户
    pub fn swap_aipartner(ctx: Context<SwapAIPartner>, payment_amount: u64) -> Result<()> {
        let presale_state = &mut ctx.accounts.presale_state;

        // 1. 计算应发放的 AIPartner 代币数量
        let aipartner_amount = payment_amount
            .checked_mul(presale_state.rate)
            .ok_or(ErrorCode::MathOverflow)?;

        // 2. 执行用户支付代币转账（由用户签名直接划转给收款账户）
        let payment_transfer_accounts = Transfer {
            from: ctx.accounts.user_payment_account.to_account_info(),
            to: ctx.accounts.vault_payment_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let token_program = ctx.accounts.token_program.to_account_info();
        let payment_cpi_ctx = CpiContext::new(token_program.clone(), payment_transfer_accounts);
        token::transfer(payment_cpi_ctx, payment_amount)?;

        // 3. 构造 PDA 签名种子（用于从金库 PDA 划转 AIPartner 给用户）
        let presale_state_key = presale_state.key();
        let seeds = &[
            b"presale_authority",
            presale_state_key.as_ref(),
            &[ctx.bumps.presale_authority],
        ];
        let signer = &[&seeds[..]];

        // 4. 执行 AIPartner 代币转账（由合约 PDA 授权从金库转给用户）
        let aipartner_transfer_accounts = Transfer {
            from: ctx.accounts.vault_aipartner_account.to_account_info(),
            to: ctx.accounts.user_aipartner_account.to_account_info(),
            authority: ctx.accounts.presale_authority.to_account_info(),
        };
        let aipartner_cpi_ctx = CpiContext::new_with_signer(token_program, aipartner_transfer_accounts, signer);
        token::transfer(aipartner_cpi_ctx, aipartner_amount)?;

        // 5. 更新销售总量统计
        presale_state.total_sold = presale_state
            .total_sold
            .checked_add(aipartner_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub aipartner_mint: Account<'info, Mint>,

    /// 由合约 PDA 控制的代币金库账户，用来存放预售代币
    #[account(
        mut,
        constraint = vault_aipartner_account.mint == aipartner_mint.key() @ ErrorCode::InvalidMint
    )]
    pub vault_aipartner_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"presale_authority", presale_state.key().as_ref()],
        bump
    )]
    /// CHECK: PDA 代理账户，作为金库的 Owner
    pub presale_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + PresaleState::INIT_SPACE
    )]
    pub presale_state: Account<'info, PresaleState>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SwapAIPartner<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_payment_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_payment_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_aipartner_account.key() == presale_state.vault_aipartner_account @ ErrorCode::InvalidVaultAccount
    )]
    pub vault_aipartner_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_aipartner_account.mint == presale_state.aipartner_mint @ ErrorCode::InvalidMint
    )]
    pub user_aipartner_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"presale_authority", presale_state.key().as_ref()],
        bump
    )]
    /// CHECK: PDA 代理账户
    pub presale_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        has_one = vault_aipartner_account @ ErrorCode::InvalidVaultAccount
    )]
    pub presale_state: Account<'info, PresaleState>,

    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct PresaleState {
    pub admin: Pubkey,
    pub aipartner_mint: Pubkey,
    pub vault_aipartner_account: Pubkey,
    pub rate: u64,
    pub total_sold: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("数值计算溢出")]
    MathOverflow,
    #[msg("无效的代币 Mint")]
    InvalidMint,
    #[msg("无效的金库代币账户")]
    InvalidVaultAccount,
}