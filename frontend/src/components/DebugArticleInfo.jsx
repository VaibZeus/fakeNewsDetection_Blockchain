import { ethers } from "ethers";
import NewsJson from "../abis/NewsRegistry.json";
import { NEWS_ADDRESS } from "../constants";

export default function DebugArticle({ contentHash }) {
  async function debug() {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(NEWS_ADDRESS, NewsJson.abi, provider);

    const a = await contract.getArticle(contentHash);
    console.log("article:", a);

    const vp = await contract.votingPeriod();
    const mv = await contract.minVotes();
    console.log("votingPeriod:", vp.toString(), "minVotes:", mv.toString());

    const now = (await provider.getBlock("latest")).timestamp;
    console.log("now:", now);
  }

  return <button onClick={debug}>Debug Article</button>;
}
