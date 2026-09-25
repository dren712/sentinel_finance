# Sentinel Robo — On-Chain Devnet Verification Gate (`docs/VERIFICATION.md`)

## 1. Deployed Solana Devnet Accounts

| Artifact | Address | Explorer Link |
| :--- | :--- | :--- |
| **Sentinel Anchor Program ID** | `3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK` | [View Program](https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet) |
| **Anchor IDL Account** | `H28SmQxnyeTQFUQFFyKjwbLBi77w78vtHmbQzQWrGHx6` | [View IDL](https://explorer.solana.com/address/H28SmQxnyeTQFUQFFyKjwbLBi77w78vtHmbQzQWrGHx6?cluster=devnet) |
| **Owner / Authority Wallet** | `GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw` | [View Wallet](https://explorer.solana.com/address/GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw?cluster=devnet) |
| **PolicyAccount PDA** (`["policy", owner]`) | `3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh` | [View Policy PDA](https://explorer.solana.com/address/3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh?cluster=devnet) |
| **AgentAccount PDA** (`["agent", owner, "robo-01"]`) | `G9MwRFgstx8Ee4dC6CYLb4CuwhR5YXXpYUhbyHrsxSpv` *(Live Devnet & Hosted)*<br>`62vpHzSG92GUbAXtNh4czG6U6HyTpndrY4NvZM9euUnQ` *(Test Harness)* | [Live Agent PDA](https://explorer.solana.com/address/G9MwRFgstx8Ee4dC6CYLb4CuwhR5YXXpYUhbyHrsxSpv?cluster=devnet) · [Test PDA](https://explorer.solana.com/address/62vpHzSG92GUbAXtNh4czG6U6HyTpndrY4NvZM9euUnQ?cluster=devnet) |
| **VaultAccount PDA** (`["vault", owner]`) | `7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y` | [View Vault PDA](https://explorer.solana.com/address/7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y?cluster=devnet) |

---

## 2. Confirmed Solana Devnet Transactions

| Lifecycle Step | Transaction Signature | Explorer Link |
| :--- | :--- | :--- |
| **1. Initialize Policy (`initialize_policy`)** | `5FStukmor2DmjU49o8s2LRxfHyp67rLzu2Ds3bbZQEg4KKKwpFcoAt14HQEvLgrkrPT1ZDtnnZGVrAbrBuE5HEnV` | [View TX](https://explorer.solana.com/tx/5FStukmor2DmjU49o8s2LRxfHyp67rLzu2Ds3bbZQEg4KKKwpFcoAt14HQEvLgrkrPT1ZDtnnZGVrAbrBuE5HEnV?cluster=devnet) |
| **2. Initialize Agent (`initialize_agent`)** | `3h9Gjcxjqmd6DWr4ST8RMEEvTVWZrejRcCSfoeQn6CoEYyKLMmGN6tdE6JEQZmaXkQEePQoobDfJU3WwNHYHz8hm` | [View TX](https://explorer.solana.com/tx/3h9Gjcxjqmd6DWr4ST8RMEEvTVWZrejRcCSfoeQn6CoEYyKLMmGN6tdE6JEQZmaXkQEePQoobDfJU3WwNHYHz8hm?cluster=devnet) |
| **3. Initialize Vault (`initialize_vault`)** | `3gD1hqUwhXLSUFTE2RLo3PBLS7mVGXYhHVHKoJ8G5Jj2RsNYb8x21rMp5ua9LhdHuh8pzre17q7WjzLtvZ98XV7V` | [View TX](https://explorer.solana.com/tx/3gD1hqUwhXLSUFTE2RLo3PBLS7mVGXYhHVHKoJ8G5Jj2RsNYb8x21rMp5ua9LhdHuh8pzre17q7WjzLtvZ98XV7V?cluster=devnet) |
| **4. Create Promise (`create_promise`)** | `3Hw2L1JWCgngXpWHQA2wxRbLCYH4AKGoT6NYhR8JYRpTy3qCsAHpyYLyvTtHVetVkUYh3BXFmX6Uud2fg3jKBzET` | [View TX](https://explorer.solana.com/tx/3Hw2L1JWCgngXpWHQA2wxRbLCYH4AKGoT6NYhR8JYRpTy3qCsAHpyYLyvTtHVetVkUYh3BXFmX6Uud2fg3jKBzET?cluster=devnet) |
| **5. Reject Non-Compliant `$15K` Trade** | `2haBLUKavXYzqa6nTtDMNaNNUu4ax5rqSnYmQKMAxCwJeqzaUw4tPSSMtDdynbWjqSW32EgqmHxaeHj4eGWsTjCD` | [View TX](https://explorer.solana.com/tx/2haBLUKavXYzqa6nTtDMNaNNUu4ax5rqSnYmQKMAxCwJeqzaUw4tPSSMtDdynbWjqSW32EgqmHxaeHj4eGWsTjCD?cluster=devnet) |
| **6. Settle Adapted `$5K` Trade (`execute_guarded_trade`)** | `59KCBrondaKxhKmTqeib4cMGFZRh1mRQW815GUeazmAK5PYwD3Vomy957XreERfXmsLQKDc3XibcjURPnWJVmqUd` | [View TX](https://explorer.solana.com/tx/59KCBrondaKxhKmTqeib4cMGFZRh1mRQW815GUeazmAK5PYwD3Vomy957XreERfXmsLQKDc3XibcjURPnWJVmqUd?cluster=devnet) |
| **7. Anchor PROVN Evidence (`record_evidence`)** | `3pvsnpVZ7A2f2ESd8jeHjbMbTYFsPv7g7RstKnNzBRpiR4mdUtCkQY5RQEPSb1fL8934sArLRp9KRDNXzFfT19Lw` | [View TX](https://explorer.solana.com/tx/3pvsnpVZ7A2f2ESd8jeHjbMbTYFsPv7g7RstKnNzBRpiR4mdUtCkQY5RQEPSb1fL8934sArLRp9KRDNXzFfT19Lw?cluster=devnet) |

---

## 3. Reproducible Verification Commands

```bash
# 1. Run all 120 unit & adversarial security tests (@sentinel/domain + @sentinel/sdk)
pnpm test

# 2. Run the live Solana Devnet P22/P23 verification script
node packages/sdk/scripts/verify-p22-p23-devnet.mjs

# 3. Build all workspace packages & Next.js production bundle
pnpm build
```
