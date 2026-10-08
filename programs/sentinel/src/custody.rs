use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::{invoke, invoke_signed};
use crate::errors::SentinelError;

pub const TOKEN_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172,
    28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169,
]);

pub const TOKEN_2022_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    6, 221, 246, 225, 238, 117, 143, 222, 24, 66, 93, 188, 228, 108, 205, 218,
    182, 26, 252, 77, 131, 185, 13, 39, 254, 189, 249, 40, 216, 161, 139, 252,
]);

#[derive(Clone, Debug)]
pub struct TokenAccountInfo {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}

/// Unpacks and validates standard SPL Token or Token-2022 Account binary layout
pub fn unpack_token_account(acc: &AccountInfo) -> Result<TokenAccountInfo> {
    require!(
        acc.owner == &TOKEN_PROGRAM_ID || acc.owner == &TOKEN_2022_PROGRAM_ID,
        SentinelError::InvalidTokenAccountOwner
    );
    let data = acc.try_borrow_data()?;
    require!(data.len() >= 72, SentinelError::InvalidTokenAccountData);
    let mint = Pubkey::new_from_array(data[0..32].try_into().unwrap());
    let owner = Pubkey::new_from_array(data[32..64].try_into().unwrap());
    let amount = u64::from_le_bytes(data[64..72].try_into().unwrap());
    Ok(TokenAccountInfo { mint, owner, amount })
}

/// Unpacks decimals from SPL Mint binary layout (decimals at byte 44)
pub fn unpack_mint_decimals(acc: &AccountInfo) -> Result<u8> {
    require!(
        acc.owner == &TOKEN_PROGRAM_ID || acc.owner == &TOKEN_2022_PROGRAM_ID,
        SentinelError::InvalidMintData
    );
    let data = acc.try_borrow_data()?;
    require!(data.len() >= 45, SentinelError::InvalidMintData);
    Ok(data[44])
}

/// Validates that the token program is either SPL Token or Token-2022,
/// and that source, destination, and mint are owned by this token program.
pub fn validate_token_program_and_accounts(
    token_program: &AccountInfo,
    source: &AccountInfo,
    destination: &AccountInfo,
    mint: &AccountInfo,
) -> Result<()> {
    require!(
        token_program.key == &TOKEN_PROGRAM_ID || token_program.key == &TOKEN_2022_PROGRAM_ID,
        SentinelError::InvalidTokenAccountOwner
    );
    require!(source.owner == token_program.key, SentinelError::InvalidTokenAccountOwner);
    require!(destination.owner == token_program.key, SentinelError::InvalidTokenAccountOwner);
    require!(mint.owner == token_program.key, SentinelError::InvalidMintData);
    Ok(())
}

/// Executes a program-signed CPI TransferChecked from vault PDA
pub fn transfer_checked_signed<'info>(
    token_program: &AccountInfo<'info>,
    source: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    destination: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    amount: u64,
    decimals: u8,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    validate_token_program_and_accounts(token_program, source, destination, mint)?;

    let mut data = Vec::with_capacity(10);
    data.push(12u8); // TransferChecked discriminator
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(decimals);

    let ix = Instruction {
        program_id: *token_program.key,
        accounts: vec![
            AccountMeta::new(*source.key, false),
            AccountMeta::new_readonly(*mint.key, false),
            AccountMeta::new(*destination.key, false),
            AccountMeta::new_readonly(*authority.key, true),
        ],
        data,
    };

    invoke_signed(
        &ix,
        &[
            source.clone(),
            mint.clone(),
            destination.clone(),
            authority.clone(),
        ],
        signer_seeds,
    )?;
    Ok(())
}

/// Executes an owner-signed CPI TransferChecked
pub fn transfer_checked_owner<'info>(
    token_program: &AccountInfo<'info>,
    source: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    destination: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    amount: u64,
    decimals: u8,
) -> Result<()> {
    validate_token_program_and_accounts(token_program, source, destination, mint)?;

    let mut data = Vec::with_capacity(10);
    data.push(12u8); // TransferChecked discriminator
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(decimals);

    let ix = Instruction {
        program_id: *token_program.key,
        accounts: vec![
            AccountMeta::new(*source.key, false),
            AccountMeta::new_readonly(*mint.key, false),
            AccountMeta::new(*destination.key, false),
            AccountMeta::new_readonly(*authority.key, true),
        ],
        data,
    };

    invoke(
        &ix,
        &[
            source.clone(),
            mint.clone(),
            destination.clone(),
            authority.clone(),
        ],
    )?;
    Ok(())
}
