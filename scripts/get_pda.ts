import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const programId = new PublicKey("5vGy3M2wsvkzsRTcoqh9hWvY1wJcJ58hHgSZ2fmC6Mjx");
  
  // 假设你的 presale_state 已经有一个固定的公钥，或者通过 findProgramAddress 计算
  // 如果 presale_state 也是个 PDA，通常 seeds 是 [b"presale_state"] 或者类似结构
  // 这里我们直接用你合约里的 seeds 规则推导 presale_authority：
  // 提示：如果 presale_authority 的 seeds 依赖于 presale_state，请确保传入正确的 presale_state 地址
  
  console.log("Program ID:", programId.toBase58());
}

main();